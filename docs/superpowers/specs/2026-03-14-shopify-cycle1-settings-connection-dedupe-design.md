# Cycle 1: Shopify Settings + Test Connection + Live Dedupe

## Goal

Add Shopify Admin API integration to the existing perfume product management tool, starting with store configuration, connection testing, and live duplicate detection against the Shopify catalog. This replaces the current CSV-only dedupe with real-time Shopify GraphQL queries while keeping all existing functionality intact.

## Architecture

```
Browser (Settings Dialog)
  → localStorage (shopDomain, accessToken, apiVersion, profileName, outputMode)
  → Frontend sends config per-request to API routes (no env vars needed)

Next.js API Routes (server-side, tokens never exposed to browser):
  POST /api/shopify/test-connection
  POST /api/shopify/dedupe

  → Shopify Admin GraphQL API (configurable version, default: 2025-01)
```

**Key decisions:**
- Tokens stored in localStorage (user explicitly accepted this trade-off for functionality)
- All Shopify API calls go through Next.js API routes (server-side proxy)
- GraphQL over REST (fewer requests, precise field selection)
- Rate limit handling with 429 retry + exponential backoff built into shared client

## Tech Stack

- Next.js 16 API Routes (App Router)
- Shopify Admin GraphQL API 2025-01
- Existing: React 19, Tailwind CSS 4, Radix UI, PapaParse

---

## Components

### 1. Shared Shopify GraphQL Client

**File:** `src/lib/shopify-client.ts`

Reusable wrapper for all Shopify API communication.

```typescript
interface ShopifyClientConfig {
  shopDomain: string;     // e.g. "nuraromas.myshopify.com"
  accessToken: string;    // shpat_xxx
  apiVersion: string;     // e.g. "2025-01"
}

interface ShopifyGraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string; locations?: any[] }>;
  extensions?: { cost: { requestedQueryCost: number; actualQueryCost: number; throttleStatus: any } };
}
```

**Functions:**
- `shopifyGraphQL<T>(config, query, variables?)` — executes GraphQL query with retry on 429 (max 3 retries, exponential backoff starting at 1s)
- `testShopifyConnection(config)` — queries `{ shop { name email primaryDomain { url } } }`, returns shop info or error
- `findProductByBarcode(config, barcode)` — queries `products(first:1, query:"barcode:{barcode}")`, returns product or null
- `findProductsByTitle(config, title, first=5)` — queries `products(first:5, query:"{normalizedTitle}")`, returns array
- `checkDuplicates(config, products)` — orchestrates barcode-first then title-fallback dedupe for an array of products

**Rate limit strategy:**
- Read `Retry-After` header on 429
- Exponential backoff: 1s → 2s → 4s
- Max 3 retries per request
- If still 429 after retries, return error (don't hang)

### 2. API Route: Test Connection

**File:** `src/app/api/shopify/test-connection/route.ts`

```
POST /api/shopify/test-connection
Body: { shopDomain, accessToken, apiVersion }
Response: { success: true, shop: { name, email, domain } }
    or:   { success: false, error: string }
```

- Validates inputs (non-empty strings)
- Calls `testShopifyConnection` from shared client
- Returns structured response

### 3. API Route: Dedupe

**File:** `src/app/api/shopify/dedupe/route.ts`

```
POST /api/shopify/dedupe
Body: { shopDomain, accessToken, apiVersion, products: Array<{ barcode: string, title: string }> }
Response: { results: Array<DedupeResult> }
```

Each `DedupeResult`:
```typescript
interface DedupeResult {
  barcode: string;
  title: string;
  isDuplicate: boolean;
  matchType: "barcode" | "title" | null;
  existingProduct?: {
    id: string;        // Shopify GID
    title: string;
    handle: string;
  };
  confidence: number;  // 1.0 for barcode, 0.85-0.99 for title
}
```

**Dedupe algorithm per product:**
1. **Barcode exact match** — `products(first:1, query:"barcode:{barcode}")`
   - If found → `isDuplicate: true, matchType: "barcode", confidence: 1.0`
2. **Title fuzzy match** (only if barcode didn't match) — normalize title (lowercase, remove accents, trim), query `products(first:5, query:"{normalized}")`
   - Compare results using Levenshtein distance
   - If best match distance < 0.15 → `isDuplicate: true, matchType: "title", confidence: 1 - distance`
3. **No match** → `isDuplicate: false, matchType: null`

**Title normalization:** Same `normalize()` function from `csv-exporter.ts` — lowercase, remove diacritics, remove non-alphanumeric.

**Levenshtein:** Simple implementation in `shopify-client.ts` (no external dependency needed, ~20 lines).

### 4. Settings Dialog Enhancement

**File:** `src/components/settings-dialog.tsx` (modify existing)

Add a "Shopify" tab/section alongside the existing "IA" configuration. The dialog gets tabs:

**Tab 1: "IA" (existing content, unchanged)**

**Tab 2: "Shopify" (new)**
- **Shop Domain** — Input, placeholder "tu-tienda.myshopify.com"
- **Access Token** — Password input with show/hide toggle, placeholder "shpat_xxx"
- **API Version** — Select: "2025-01" (default), "2024-10", "2024-07"
- **Profile Name** — Input, placeholder "Mi Tienda Principal"
- **Test Connection** button — triggers POST to `/api/shopify/test-connection`
  - States: idle → testing (spinner) → connected (green check + shop name) → error (red X + message)
- **Output Mode** — Radio group: "Solo CSV" (default), "Solo Shopify Live" (disabled, "Ciclo 2"), "CSV + Shopify Live" (disabled, "Ciclo 2")

**localStorage keys:**
- `shopify_shop_domain`
- `shopify_access_token`
- `shopify_api_version`
- `shopify_profile_name`
- `shopify_output_mode` (default: "csv_only")
- `shopify_connected` (boolean flag from last successful test)

**Dialog width:** Expand from `sm:max-w-[425px]` to `sm:max-w-[550px]` to accommodate tabs.

### 5. Live Dedupe Integration in UI

**File:** `src/components/products-table.tsx` (modify existing)

After products are loaded/processed, if Shopify is configured (`shopify_connected === "true"` in localStorage):

- Show a "Verificar Duplicados en Shopify" button in the table toolbar area
- Button triggers POST to `/api/shopify/dedupe` with all current products' barcode + title
- While checking: show spinner on the button, disable it
- Results update the `ProcessedProduct[]` state:
  - `isDuplicate: true` products get `isChecked: false`
  - New badge/indicator in the table: "Nuevo" (green) or "Duplicado: barcode/título" (red/amber)
  - Duplicate rows show the existing Shopify product title for reference

**File:** `src/lib/product-processor.ts` (modify existing)

Add optional fields to `ProcessedProduct`:
```typescript
// Shopify dedupe results (optional, populated after live check)
shopifyDupeMatchType?: "barcode" | "title" | null;
shopifyDupeExistingTitle?: string;
shopifyDupeExistingId?: string;
shopifyDupeConfidence?: number;
```

### 6. Shopify Connection Status Indicator

**File:** `src/components/main-nav.tsx` (modify existing)

Small indicator next to the Settings gear icon:
- Green dot if `shopify_connected === "true"` in localStorage
- No dot if not configured
- Clicking opens Settings dialog on Shopify tab

---

## What Does NOT Change

- CSV import/export flow (fully preserved)
- AI content generation (unchanged)
- Manual product entry (unchanged)
- Supabase backup/session recovery (unchanged)
- File dropzone and parsing logic (unchanged)
- Product review dialog (unchanged)
- PDF generation (unchanged)

## Data Flow

```
1. User opens Settings → Shopify tab → enters credentials → Test Connection
2. API route queries Shopify GraphQL → returns shop info → UI shows "Connected"
3. User loads CSV or adds products manually (existing flow, no changes)
4. User clicks "Verificar Duplicados en Shopify" button
5. Frontend sends products array to /api/shopify/dedupe
6. API route queries Shopify per product: barcode first, then title fallback
7. Results return → products marked as duplicate/new in state
8. Duplicates unchecked by default, user can re-enable manually
9. User proceeds with CSV export as usual (Cycle 2 adds live publish)
```

## Error Handling

- **Invalid credentials:** Test Connection returns clear error, UI shows message
- **Rate limited (429):** Auto-retry with backoff, if exhausted show "Shopify está ocupado, intenta en unos segundos"
- **Network error:** Show "No se puede conectar a Shopify. Verifica tu conexión."
- **Partial dedupe failure:** If some products fail dedupe, mark them as "unknown" (yellow badge), don't block the rest
- **No Shopify config:** Dedupe button hidden, everything works as before (CSV-only)

## Security Notes

Per user's explicit instruction: security is deprioritized for functionality. Tokens in localStorage is accepted. No encryption layer needed for now. API routes don't validate origin. This can be hardened in a future cycle if needed.

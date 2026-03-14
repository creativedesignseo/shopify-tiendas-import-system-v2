# Cycle 1: Shopify Settings + Test Connection + Live Dedupe

## Goal

Add Shopify Admin API integration to the existing perfume product management tool, starting with store configuration, connection testing, and live duplicate detection against the Shopify catalog. This replaces the current CSV-only dedupe with real-time Shopify GraphQL queries while keeping all existing functionality intact.

## Architecture

```
Browser (Settings Dialog)
  → localStorage (shopDomain, accessToken, apiVersion, profileName, outputMode)
  → Frontend sends config per-request to API routes (no env vars needed)

Next.js API Routes (server-side proxy — Shopify calls never made from browser JS):
  POST /api/shopify/test-connection
  POST /api/shopify/dedupe

  → Shopify Admin GraphQL API (configurable version, default: 2025-01)
```

**Key decisions:**
- Tokens stored in localStorage (user explicitly accepted this trade-off for functionality). They are sent to our own API routes only, never to third-party scripts or client-rendered HTML.
- All Shopify API calls go through Next.js API routes (server-side proxy, prevents CORS and keeps tokens off the network from the browser's perspective)
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
- `findProductByBarcode(config, barcode)` — uses `productVariants(first:1, query:"barcode:{barcode}")` to find by variant barcode (more reliable than product-level search), returns product or null
- `findProductsByTitle(config, title, first=5)` — queries `products(first:5, query:"{searchTitle}")` where searchTitle preserves spaces but removes diacritics, returns array
- `checkDuplicates(config, products)` — orchestrates barcode-first then title-fallback dedupe for an array of products, processing in batches (see Batching Strategy below)

**Rate limit strategy:**
- Read `Retry-After` header on 429
- Exponential backoff: 1s → 2s → 4s
- Max 3 retries per request
- If still 429 after retries, return error for that product (don't hang)

**Batching strategy:**
- The dedupe API route processes products in batches of 10
- Each batch runs sequentially (1-2 queries per product = 10-20 queries per batch)
- The frontend sends ALL products in one request, the API route handles batching internally
- Next.js API route timeout: set `maxDuration = 120` (2 minutes) to accommodate large sets
- Progress: the API route returns all results at once (streaming deferred to Cycle 2)
- For typical imports (20-50 products), this completes in 10-30 seconds

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
1. **Barcode exact match** — `productVariants(first:1, query:"barcode:{barcode}")` then navigate to parent product
   - If found → `isDuplicate: true, matchType: "barcode", confidence: 1.0`
2. **Title fuzzy match** (only if barcode didn't match) — normalize title for search (lowercase, remove diacritics, preserve spaces), query `products(first:5, query:"{searchTitle}")`
   - Compare each result using normalized Levenshtein distance ratio (distance / max(len(a), len(b)))
   - If best match ratio < 0.15 → `isDuplicate: true, matchType: "title", confidence: 1 - ratio`
   - This means titles with ≥85% similarity are flagged as duplicates
3. **No match** → `isDuplicate: false, matchType: null`

**Title normalization for search (NEW function, not the csv-exporter one):**
`normalizeForSearch(title)` — lowercase, remove diacritics (NFD + strip combining marks), trim extra whitespace. Preserves spaces and basic punctuation so Shopify search can match properly. Different from `csv-exporter.ts`'s `normalize()` which strips ALL non-alphanumeric (designed for header matching).

**Levenshtein:** Simple implementation in `shopify-client.ts` (~20 lines). Returns normalized ratio: `distance / Math.max(a.length, b.length)`. Range: 0.0 (identical) to 1.0 (completely different).

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
- `shopify_connected` (string `"true"` or `"false"` — localStorage only stores strings, always compare with `=== "true"`)

**Dialog width:** Expand from `sm:max-w-[425px]` to `sm:max-w-[550px]` to accommodate tabs.

**Save behavior:** One "Guardar Cambios" button saves both IA and Shopify settings. The existing `handleSave` function is extended to also persist Shopify fields. Test Connection is a separate action (does not require saving first — it uses the current field values directly).

### 5. Live Dedupe Integration in UI

**File:** `src/components/products-table.tsx` (modify existing)

After products are loaded/processed, if Shopify is configured (`shopify_connected === "true"` in localStorage):

- Show a "Verificar Duplicados en Shopify" button in the table toolbar area
- Button triggers POST to `/api/shopify/dedupe` with all current products' barcode + title
- While checking: show spinner on the button, disable it
- While checking: show spinner + progress text ("Verificando 5/23...")
- Results update the `ProcessedProduct[]` state:
  - Products with `shopifyDupeMatchType !== null` get `isChecked: false`
  - New badge/indicator in the table: "Nuevo" (green) or "Duplicado: barcode/título" (red/amber)
  - Duplicate rows show the existing Shopify product title for reference

**File:** `src/lib/product-processor.ts` (modify existing)

Add optional fields to `ProcessedProduct` (separate from the existing `isDuplicate` which is used for CSV-based dedupe during import — CSV dedupe removes products entirely, Shopify dedupe only unchecks them):
```typescript
// Shopify dedupe results (optional, populated after live check)
shopifyDupeMatchType?: "barcode" | "title" | null;
shopifyDupeExistingTitle?: string;
shopifyDupeExistingId?: string;
shopifyDupeConfidence?: number;
```

**Note:** The existing `isDuplicate` boolean is NOT reused for Shopify dedupe. It remains for CSV-level duplicate filtering (products removed before reaching the table). The `shopifyDupeMatchType` field indicates Shopify-level duplicates (products stay in the table but unchecked).

### 6. Shopify Connection Status Indicator

**File:** `src/app/page.tsx` (modify existing — the Settings gear icon lives here at ~line 358, not in main-nav.tsx)

Small green dot indicator next to the existing `<SettingsDialog />` component:
- Green dot if `shopify_connected === "true"` in localStorage
- No dot if not configured
- The dot is purely visual (clicking the gear opens Settings as usual, user can navigate to Shopify tab)

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

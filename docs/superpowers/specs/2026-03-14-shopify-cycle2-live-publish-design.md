# Cycle 2: Shopify Live Publish + Output Modes

## Goal

Add live product creation via Shopify Admin GraphQL API, supporting three output modes (CSV only, Shopify Live only, CSV + Shopify Live), with per-product progress tracking, dry-run mode, and a final summary with created/skipped/failed counts.

## Architecture

```
Existing Cycle 1 infrastructure:
  - shopify-client.ts (GraphQL client, retry, dedupe)
  - Settings Dialog (credentials, output mode selector)
  - API routes: test-connection, dedupe

New in Cycle 2:
  POST /api/shopify/publish — creates products via Shopify Admin API

  Frontend:
    - handleExport updated to check outputMode
    - ShopifyPublishDialog — progress tracker + summary
```

**Key decisions:**
- Product creation via GraphQL `productCreate` mutation (not REST)
- All fields mapped: title, body_html, vendor, tags, images, variants, metafields, SEO
- Dry-run mode: validates data without creating products (frontend-only validation)
- Per-product progress via polling (API route returns results for all products at once)
- Rate limit handling inherited from shopify-client.ts

## Tech Stack

Same as Cycle 1 + Shopify `productCreate` GraphQL mutation

---

## Components

### 1. Shopify Product Creation Function

**File:** `src/lib/shopify-client.ts` (extend existing)

Add function `createShopifyProduct(config, product)`:

```typescript
interface ShopifyProductInput {
  title: string;
  bodyHtml: string;
  vendor: string;
  productType: string;
  tags: string[];
  status: "ACTIVE" | "DRAFT";
  seoTitle?: string;
  seoDescription?: string;
  images: Array<{ src: string; altText?: string }>;
  variants: Array<{
    price: string;
    sku?: string;
    barcode?: string;
    inventoryQuantity?: number;
    weight?: number;
    weightUnit?: string;
    requiresShipping?: boolean;
    taxable?: boolean;
    inventoryPolicy?: string;
    option1?: string;
    costPerItem?: string;
  }>;
  metafields?: Array<{
    namespace: string;
    key: string;
    value: string;
    type: string;
  }>;
}

interface CreateProductResult {
  success: boolean;
  productId?: string;
  handle?: string;
  error?: string;
}
```

Uses GraphQL mutation:
```graphql
mutation productCreate($input: ProductInput!) {
  productCreate(input: $input) {
    product {
      id
      handle
    }
    userErrors {
      field
      message
    }
  }
}
```

Also add `publishProducts(config, products)` — batch orchestrator that creates products sequentially (to respect rate limits), returns array of results with per-product status.

### 2. API Route: Publish

**File:** `src/app/api/shopify/publish/route.ts`

```
POST /api/shopify/publish
Body: {
  shopDomain, accessToken, apiVersion,
  products: ProcessedProduct[],
  dryRun: boolean
}
Response: {
  success: boolean,
  results: Array<{
    barcode: string,
    title: string,
    status: "created" | "skipped" | "failed",
    productId?: string,
    handle?: string,
    error?: string
  }>,
  summary: { created: number, skipped: number, failed: number }
}
```

- If `dryRun: true` → validates each product (required fields check) but does NOT call Shopify API
- If `dryRun: false` → creates each product via `createShopifyProduct`, skips if dedupe found duplicate
- Products with `shopifyDupeMatchType !== null` are auto-skipped (status: "skipped")
- Sequential creation (1 product at a time to respect rate limits)
- `maxDuration = 300` (5 minutes for large batches)

### 3. Shopify Publish Dialog

**File:** `src/components/shopify-publish-dialog.tsx` (new)

Modal dialog that shows during/after publishing:

**States:**
1. **Pre-publish** (confirmation): Shows count of products to publish, dry-run toggle, "Publicar" button
2. **Publishing** (progress): Per-product progress bar, current product name, created/skipped/failed counters
3. **Complete** (summary): Final counts, list of failed products with errors, "Descargar Reporte" button

**Props:**
```typescript
interface ShopifyPublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: ProcessedProduct[];
  onPublishComplete: (results: PublishResult[]) => void;
}
```

### 4. Export Flow Integration

**File:** `src/app/page.tsx` (modify handleExport)

The existing `handleExport` function checks `shopify_output_mode` from localStorage:

- **"csv_only"**: Current behavior (download CSV)
- **"shopify_only"**: Opens ShopifyPublishDialog instead of downloading CSV
- **"csv_and_shopify"**: Opens ShopifyPublishDialog, and after completion, also downloads CSV

The export button text changes based on mode:
- "Exportar CSV (N)" → csv_only
- "Publicar en Shopify (N)" → shopify_only
- "Exportar + Publicar (N)" → csv_and_shopify

### 5. Product-to-Shopify Mapper

**File:** `src/lib/shopify-mapper.ts` (new)

Converts `ProcessedProduct` → `ShopifyProductInput`. Centralized mapping logic:

```typescript
export function mapProductToShopify(product: ProcessedProduct): ShopifyProductInput
```

Maps:
- title → product.generatedTitle
- bodyHtml → product.bodyHtml
- vendor → product.vendor
- productType → "Eau de Parfum"
- tags → product.tags.split(",").map(t => t.trim())
- status → "ACTIVE"
- seoTitle → product.seoTitle
- seoDescription → product.seoDescription
- images → product.images.map((src, i) => ({ src, altText: i === 0 ? product.generatedTitle : "" }))
- variant.price → product.price (cleaned: remove €, convert comma to dot)
- variant.barcode → product.barcode
- variant.sku → product.barcode
- variant.weight → 350 (grams)
- variant.weightUnit → "GRAMS"
- variant.option1 → product.size || "100ml"
- variant.costPerItem → product.costPerItem (cleaned)
- variant.inventoryQuantity → 10
- variant.requiresShipping → true
- variant.taxable → true
- metafields → mapped from product.metafields (acorde, genero, notas_salida, etc.)

Price cleaning: `"54,00 €"` → `"54.00"` (remove €, replace comma with dot)

---

## Data Flow

```
1. User has products processed (status: "complete", isChecked: true)
2. User's output mode is "shopify_only" or "csv_and_shopify"
3. User clicks Export button → ShopifyPublishDialog opens
4. Dialog shows confirmation: "Publicar N productos en Nur Aromas?"
5. User toggles dry-run or clicks "Publicar"
6. Frontend sends products to /api/shopify/publish
7. API route creates products one by one via GraphQL
8. Results return → dialog shows summary
9. If mode is "csv_and_shopify", CSV also downloads after publish
10. User can download a report of what was created/failed
```

## Error Handling

- **Validation errors** (dry-run): Show which fields are missing/invalid per product
- **GraphQL userErrors**: Show Shopify's error message for that product, continue with next
- **Rate limited**: Inherited retry from shopify-client.ts
- **Network failure**: Show error, allow retry for failed products
- **Partial success**: Some products created, some failed — summary shows both

## What Does NOT Change

- CSV export flow (still works for "csv_only" mode)
- AI generation, manual entry, Supabase backup
- Dedupe from Cycle 1 (still works, auto-skips duplicates during publish)

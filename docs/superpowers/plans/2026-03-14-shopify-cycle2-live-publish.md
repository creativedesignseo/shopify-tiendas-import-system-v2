# Shopify Cycle 2: Live Publish — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan.

**Goal:** Add live product creation via Shopify Admin GraphQL API with 3 output modes, progress tracking, dry-run, and publish summary.

**Architecture:** Product mapper converts ProcessedProduct → ShopifyProductInput. API route creates products sequentially via GraphQL mutation. Publish dialog shows real-time progress and summary.

**Tech Stack:** Next.js 16, Shopify Admin GraphQL API 2025-01, React 19, existing shopify-client.ts

**Spec:** `docs/superpowers/specs/2026-03-14-shopify-cycle2-live-publish-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/lib/shopify-mapper.ts` | Convert ProcessedProduct → ShopifyProductInput |
| Modify | `src/lib/shopify-client.ts` | Add createShopifyProduct + publishProducts functions |
| Create | `src/app/api/shopify/publish/route.ts` | API route for product creation |
| Create | `src/components/shopify-publish-dialog.tsx` | Publish progress dialog |
| Modify | `src/app/page.tsx` | Update export flow for 3 output modes |

---

## Task 1: Create Product-to-Shopify Mapper

**Files:**
- Create: `src/lib/shopify-mapper.ts`

- [ ] **Step 1: Create the mapper file**

```typescript
// src/lib/shopify-mapper.ts
import { ProcessedProduct } from "./product-processor";

export interface ShopifyProductInput {
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
    inventoryQuantities?: { availableQuantity: number; locationId: string };
    weight?: number;
    weightUnit?: string;
    requiresShipping?: boolean;
    taxable?: boolean;
    options?: string[];
    cost?: string;
  }>;
  metafields?: Array<{
    namespace: string;
    key: string;
    value: string;
    type: string;
  }>;
}

/**
 * Clean European price format: "54,00 €" → "54.00"
 */
function cleanPrice(price: string): string {
  if (!price) return "0.00";
  return price
    .replace(/€/g, "")
    .replace(/\s/g, "")
    .replace(",", ".")
    .trim() || "0.00";
}

/**
 * Map a ProcessedProduct to Shopify's productCreate input format.
 */
export function mapProductToShopify(product: ProcessedProduct): ShopifyProductInput {
  const tags = product.tags
    ? product.tags.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  const images = product.images
    .filter((src) => src && src.trim())
    .map((src, i) => ({
      src,
      altText: i === 0 ? product.generatedTitle : "",
    }));

  const metafields: ShopifyProductInput["metafields"] = [];
  const metafieldMap: Record<string, { key: string; namespace: string }> = {
    acorde: { key: "acorde", namespace: "custom" },
    genero: { key: "genero", namespace: "custom" },
    notas_salida: { key: "notas_salida", namespace: "custom" },
    ocasion: { key: "ocasion", namespace: "custom" },
    estacion: { key: "estacion", namespace: "custom" },
    aroma: { key: "aroma", namespace: "custom" },
    sexo_objetivo: { key: "sexo_objetivo", namespace: "custom" },
  };

  for (const [field, config] of Object.entries(metafieldMap)) {
    const value = product.metafields[field as keyof typeof product.metafields];
    if (value) {
      metafields.push({
        namespace: config.namespace,
        key: config.key,
        value,
        type: "single_line_text_field",
      });
    }
  }

  return {
    title: product.generatedTitle,
    bodyHtml: product.bodyHtml,
    vendor: product.vendor,
    productType: "Eau de Parfum",
    tags,
    status: "ACTIVE",
    seoTitle: product.seoTitle || undefined,
    seoDescription: product.seoDescription || undefined,
    images,
    variants: [
      {
        price: cleanPrice(product.price),
        sku: product.barcode || undefined,
        barcode: product.barcode || undefined,
        weight: 350,
        weightUnit: "GRAMS",
        requiresShipping: true,
        taxable: true,
        options: [product.size || "100ml"],
        cost: product.costPerItem ? cleanPrice(product.costPerItem) : undefined,
      },
    ],
    metafields: metafields.length > 0 ? metafields : undefined,
  };
}

/**
 * Validate a product has minimum required fields for Shopify creation.
 * Returns array of missing field names, empty if valid.
 */
export function validateForShopify(product: ProcessedProduct): string[] {
  const missing: string[] = [];
  if (!product.generatedTitle) missing.push("Título");
  if (!product.price) missing.push("Precio");
  if (!product.vendor) missing.push("Marca");
  return missing;
}
```

- [ ] **Step 2: Build verify**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/lib/shopify-mapper.ts
git commit -m "feat: add product-to-Shopify mapper with price cleaning and validation"
```

---

## Task 2: Add createShopifyProduct to shopify-client.ts

**Files:**
- Modify: `src/lib/shopify-client.ts`

- [ ] **Step 1: Add the createShopifyProduct function and publishProducts orchestrator**

Append to `src/lib/shopify-client.ts`:

```typescript
import { ShopifyProductInput } from "./shopify-mapper";

export interface CreateProductResult {
  barcode: string;
  title: string;
  status: "created" | "skipped" | "failed";
  productId?: string;
  handle?: string;
  error?: string;
}

export async function createShopifyProduct(
  config: ShopifyClientConfig,
  input: ShopifyProductInput
): Promise<CreateProductResult> {
  const mutation = `
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
  `;

  const productInput: Record<string, any> = {
    title: input.title,
    bodyHtml: input.bodyHtml,
    vendor: input.vendor,
    productType: input.productType,
    tags: input.tags,
    status: input.status,
    images: input.images.map((img) => ({ src: img.src, altText: img.altText })),
    variants: input.variants.map((v) => ({
      price: v.price,
      sku: v.sku,
      barcode: v.barcode,
      weight: v.weight,
      weightUnit: v.weightUnit,
      requiresShipping: v.requiresShipping,
      taxable: v.taxable,
      options: v.options,
    })),
    seo: input.seoTitle || input.seoDescription
      ? { title: input.seoTitle, description: input.seoDescription }
      : undefined,
    metafields: input.metafields,
  };

  // Add cost per item to variant if present
  if (input.variants[0]?.cost) {
    productInput.variants[0].inventoryItem = {
      cost: input.variants[0].cost,
    };
  }

  try {
    const result = await shopifyGraphQL<{
      productCreate: {
        product: { id: string; handle: string } | null;
        userErrors: Array<{ field: string[]; message: string }>;
      };
    }>(config, mutation, { input: productInput });

    if (result.errors && result.errors.length > 0) {
      return {
        barcode: input.variants[0]?.barcode || "",
        title: input.title,
        status: "failed",
        error: result.errors.map((e) => e.message).join(", "),
      };
    }

    const data = result.data?.productCreate;
    if (data?.userErrors && data.userErrors.length > 0) {
      return {
        barcode: input.variants[0]?.barcode || "",
        title: input.title,
        status: "failed",
        error: data.userErrors.map((e) => e.message).join(", "),
      };
    }

    return {
      barcode: input.variants[0]?.barcode || "",
      title: input.title,
      status: "created",
      productId: data?.product?.id,
      handle: data?.product?.handle,
    };
  } catch (err: any) {
    return {
      barcode: input.variants[0]?.barcode || "",
      title: input.title,
      status: "failed",
      error: err.message || "Error desconocido",
    };
  }
}
```

- [ ] **Step 2: Build verify**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/lib/shopify-client.ts
git commit -m "feat: add createShopifyProduct function to shopify-client"
```

---

## Task 3: Create Publish API Route

**Files:**
- Create: `src/app/api/shopify/publish/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// src/app/api/shopify/publish/route.ts
import { NextResponse } from "next/server";
import { createShopifyProduct, CreateProductResult } from "@/lib/shopify-client";
import { mapProductToShopify, validateForShopify } from "@/lib/shopify-mapper";
import { ProcessedProduct } from "@/lib/product-processor";

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const { shopDomain, accessToken, apiVersion, products, dryRun } = await req.json();

    if (!shopDomain || !accessToken || !apiVersion) {
      return NextResponse.json(
        { success: false, error: "Faltan credenciales de Shopify" },
        { status: 400 }
      );
    }

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { success: false, error: "No se proporcionaron productos" },
        { status: 400 }
      );
    }

    const config = { shopDomain, accessToken, apiVersion };
    const results: CreateProductResult[] = [];
    let created = 0, skipped = 0, failed = 0;

    for (const product of products as ProcessedProduct[]) {
      // Skip duplicates detected by Cycle 1 dedupe
      if (product.shopifyDupeMatchType) {
        results.push({
          barcode: product.barcode,
          title: product.generatedTitle || product.title,
          status: "skipped",
          error: `Duplicado (${product.shopifyDupeMatchType})`,
        });
        skipped++;
        continue;
      }

      // Validate required fields
      const missingFields = validateForShopify(product);
      if (missingFields.length > 0) {
        results.push({
          barcode: product.barcode,
          title: product.generatedTitle || product.title,
          status: "failed",
          error: `Campos faltantes: ${missingFields.join(", ")}`,
        });
        failed++;
        continue;
      }

      // Dry run: validate only, don't create
      if (dryRun) {
        results.push({
          barcode: product.barcode,
          title: product.generatedTitle || product.title,
          status: "created",
        });
        created++;
        continue;
      }

      // Live: create product in Shopify
      const shopifyInput = mapProductToShopify(product);
      const result = await createShopifyProduct(config, shopifyInput);
      results.push(result);

      if (result.status === "created") created++;
      else if (result.status === "skipped") skipped++;
      else failed++;
    }

    return NextResponse.json({
      success: true,
      results,
      summary: { created, skipped, failed },
      dryRun: !!dryRun,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Error durante la publicación" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Build verify**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/shopify/publish/route.ts
git commit -m "feat: add /api/shopify/publish route with dry-run support"
```

---

## Task 4: Create Shopify Publish Dialog

**Files:**
- Create: `src/components/shopify-publish-dialog.tsx`

- [ ] **Step 1: Create the dialog component**

This dialog has 3 states: confirmation → publishing → summary.

```typescript
// Full component in implementation — key structure:
// Props: open, onOpenChange, products, onPublishComplete
// State: phase ("confirm" | "publishing" | "complete"), dryRun, results, progress
// Confirmation: product count, dry-run toggle, publish button
// Publishing: progress bar, current product, live counters (created/skipped/failed)
// Summary: final counts, failed products list, download report button
```

The dialog should:
- Show shop name from localStorage
- Let user toggle dry-run mode
- Show a progress bar during publishing (N/total)
- Display per-product status as they complete
- On complete: show summary with created (green), skipped (yellow), failed (red) counts
- Allow downloading a simple text report of results

- [ ] **Step 2: Build verify**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/components/shopify-publish-dialog.tsx
git commit -m "feat: add Shopify publish dialog with progress and summary"
```

---

## Task 5: Update Export Flow for Output Modes

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add state for publish dialog and read output mode**

Add state: `showPublishDialog`, `outputMode`
Read `shopify_output_mode` from localStorage on mount.

- [ ] **Step 2: Update handleExport to check output mode**

```typescript
const handleExport = () => {
  const readyProducts = products.filter(p => p.status === "complete" && p.isChecked);
  if (readyProducts.length === 0) {
    alert("No hay productos listos para exportar.");
    return;
  }

  const mode = localStorage.getItem("shopify_output_mode") || "csv_only";

  if (mode === "csv_only") {
    // Existing CSV download logic
    downloadCSV(readyProducts);
  } else if (mode === "shopify_only") {
    setShowPublishDialog(true);
  } else if (mode === "csv_and_shopify") {
    setShowPublishDialog(true);
    // CSV download happens after publish completes (in onPublishComplete)
  }
};
```

- [ ] **Step 3: Update export button text based on mode**

```tsx
<Button onClick={handleExport} disabled={...}>
  <Download className="mr-2 h-4 w-4 shrink-0" />
  {outputMode === "shopify_only"
    ? `Publicar (${count})`
    : outputMode === "csv_and_shopify"
    ? `Exportar + Publicar (${count})`
    : `Exportar (${count})`}
</Button>
```

- [ ] **Step 4: Add ShopifyPublishDialog to the JSX**

Import and render the dialog, with onPublishComplete that optionally downloads CSV for "csv_and_shopify" mode.

- [ ] **Step 5: Build verify**

Run: `npm run build`

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: update export flow for 3 output modes (csv, shopify, both)"
```

---

## Task 6: Final Build + Manual Test

- [ ] **Step 1: Full build**

Run: `npm run build`

- [ ] **Step 2: Manual test checklist**

1. Mode "Solo CSV" → export works as before
2. Mode "Solo Shopify Live" → clicking export opens publish dialog
3. Dry-run → shows validation results without creating products
4. Live publish → creates products in Shopify, shows progress
5. Mode "CSV + Shopify" → publishes then downloads CSV
6. Failed products show errors in summary
7. Dedupe-flagged products are auto-skipped

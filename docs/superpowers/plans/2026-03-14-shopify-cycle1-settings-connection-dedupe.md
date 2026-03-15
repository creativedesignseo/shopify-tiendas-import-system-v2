# Shopify Cycle 1: Settings + Connection + Live Dedupe — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Shopify store configuration, connection testing, and live duplicate detection against the Shopify catalog to the existing perfume product management tool.

**Architecture:** Settings stored in localStorage, sent per-request to Next.js API routes that proxy all Shopify GraphQL calls. The shared client (`shopify-client.ts`) handles retry/backoff. Dedupe checks barcode first (via `productVariants` query), then falls back to fuzzy title matching with Levenshtein distance.

**Tech Stack:** Next.js 16 (App Router), Shopify Admin GraphQL API 2025-01, React 19, Tailwind CSS 4, Radix UI Tabs, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-14-shopify-cycle1-settings-connection-dedupe-design.md`

**Testing strategy:** No test framework is configured in this project. Verification is done via `npm run build` (TypeScript + Next.js compilation) and manual browser testing. Each task ends with a build check.

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/lib/shopify-client.ts` | Shared Shopify GraphQL client: query execution, retry/backoff, connection test, barcode/title search, dedupe orchestration, Levenshtein, normalizeForSearch |
| Create | `src/app/api/shopify/test-connection/route.ts` | API route: validates inputs, calls testShopifyConnection, returns shop info |
| Create | `src/app/api/shopify/dedupe/route.ts` | API route: receives products array, calls checkDuplicates in batches, returns results |
| Modify | `src/lib/product-processor.ts` | Add 4 optional Shopify dedupe fields to ProcessedProduct interface |
| Modify | `src/components/settings-dialog.tsx` | Add Shopify tab with credentials, Test Connection button, output mode selector |
| Modify | `src/components/products-table.tsx` | Add "Verificar Duplicados en Shopify" button + duplicate badges in table |
| Modify | `src/app/page.tsx` | Add green dot connection indicator next to SettingsDialog |

---

## Chunk 1: Core Library + API Routes

### Task 1: Create Shopify GraphQL Client

**Files:**
- Create: `src/lib/shopify-client.ts`

This is the foundation — all other tasks depend on it.

- [ ] **Step 1: Create the shopify-client.ts file with types and core GraphQL function**

```typescript
// src/lib/shopify-client.ts

export interface ShopifyClientConfig {
  shopDomain: string;
  accessToken: string;
  apiVersion: string;
}

export interface ShopifyGraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{ message: string; locations?: any[] }>;
  extensions?: {
    cost: {
      requestedQueryCost: number;
      actualQueryCost: number;
      throttleStatus: any;
    };
  };
}

export interface DedupeResult {
  barcode: string;
  title: string;
  isDuplicate: boolean;
  matchType: "barcode" | "title" | null;
  existingProduct?: {
    id: string;
    title: string;
    handle: string;
  };
  confidence: number;
}

/**
 * Normalize a title for Shopify search: lowercase, remove diacritics, preserve spaces.
 * NOT the same as csv-exporter's normalize() which strips all non-alphanumeric.
 */
export function normalizeForSearch(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Levenshtein distance between two strings.
 * Returns normalized ratio: 0.0 (identical) to 1.0 (completely different).
 */
export function levenshteinRatio(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0 || b.length === 0) return 1;

  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length] / Math.max(a.length, b.length);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Execute a GraphQL query against Shopify Admin API.
 * Retries on 429 with exponential backoff (max 3 retries).
 */
export async function shopifyGraphQL<T = any>(
  config: ShopifyClientConfig,
  query: string,
  variables?: Record<string, any>
): Promise<ShopifyGraphQLResponse<T>> {
  const url = `https://${config.shopDomain}/admin/api/${config.apiVersion}/graphql.json`;

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) {
      await sleep(1000 * Math.pow(2, attempt - 1)); // 1s, 2s, 4s
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": config.accessToken,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (res.status === 429) {
      const retryAfter = res.headers.get("Retry-After");
      if (retryAfter && attempt < 3) {
        await sleep(parseInt(retryAfter, 10) * 1000);
      }
      lastError = new Error("Rate limited by Shopify (429)");
      continue;
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Shopify API error ${res.status}: ${text}`);
    }

    return (await res.json()) as ShopifyGraphQLResponse<T>;
  }

  throw lastError || new Error("Max retries exceeded");
}
```

- [ ] **Step 2: Add testShopifyConnection function**

Append to the same file:

```typescript
export interface ShopInfo {
  name: string;
  email: string;
  domain: string;
}

export async function testShopifyConnection(
  config: ShopifyClientConfig
): Promise<{ success: true; shop: ShopInfo } | { success: false; error: string }> {
  try {
    const result = await shopifyGraphQL<{
      shop: { name: string; email: string; primaryDomain: { url: string } };
    }>(
      config,
      `{ shop { name email primaryDomain { url } } }`
    );

    if (result.errors && result.errors.length > 0) {
      return { success: false, error: result.errors[0].message };
    }

    if (!result.data?.shop) {
      return { success: false, error: "No shop data returned" };
    }

    return {
      success: true,
      shop: {
        name: result.data.shop.name,
        email: result.data.shop.email,
        domain: result.data.shop.primaryDomain.url,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Connection failed" };
  }
}
```

- [ ] **Step 3: Add findProductByBarcode function**

Append to the same file:

```typescript
export async function findProductByBarcode(
  config: ShopifyClientConfig,
  barcode: string
): Promise<{ id: string; title: string; handle: string } | null> {
  const query = `
    query FindByBarcode($query: String!) {
      productVariants(first: 1, query: $query) {
        edges {
          node {
            product {
              id
              title
              handle
            }
          }
        }
      }
    }
  `;

  const result = await shopifyGraphQL<{
    productVariants: {
      edges: Array<{
        node: { product: { id: string; title: string; handle: string } };
      }>;
    };
  }>(config, query, { query: `barcode:${barcode}` });

  const edge = result.data?.productVariants?.edges?.[0];
  if (!edge) return null;

  return {
    id: edge.node.product.id,
    title: edge.node.product.title,
    handle: edge.node.product.handle,
  };
}
```

- [ ] **Step 4: Add findProductsByTitle function**

Append to the same file:

```typescript
export async function findProductsByTitle(
  config: ShopifyClientConfig,
  title: string,
  first: number = 5
): Promise<Array<{ id: string; title: string; handle: string }>> {
  const searchTitle = normalizeForSearch(title);
  const query = `
    query FindByTitle($query: String!, $first: Int!) {
      products(first: $first, query: $query) {
        edges {
          node {
            id
            title
            handle
          }
        }
      }
    }
  `;

  const result = await shopifyGraphQL<{
    products: {
      edges: Array<{
        node: { id: string; title: string; handle: string };
      }>;
    };
  }>(config, query, { query: searchTitle, first });

  return (
    result.data?.products?.edges?.map((e) => ({
      id: e.node.id,
      title: e.node.title,
      handle: e.node.handle,
    })) || []
  );
}
```

- [ ] **Step 5: Add checkDuplicates function (orchestrator with batching)**

Append to the same file:

```typescript
export async function checkDuplicates(
  config: ShopifyClientConfig,
  products: Array<{ barcode: string; title: string }>
): Promise<DedupeResult[]> {
  const BATCH_SIZE = 10;
  const results: DedupeResult[] = [];

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map(async (product): Promise<DedupeResult> => {
        try {
          // 1. Barcode exact match
          if (product.barcode) {
            const found = await findProductByBarcode(config, product.barcode);
            if (found) {
              return {
                barcode: product.barcode,
                title: product.title,
                isDuplicate: true,
                matchType: "barcode",
                existingProduct: found,
                confidence: 1.0,
              };
            }
          }

          // 2. Title fuzzy match
          if (product.title) {
            const candidates = await findProductsByTitle(config, product.title);
            const normalizedInput = normalizeForSearch(product.title);

            let bestMatch: { product: typeof candidates[0]; ratio: number } | null = null;

            for (const candidate of candidates) {
              const normalizedCandidate = normalizeForSearch(candidate.title);
              const ratio = levenshteinRatio(normalizedInput, normalizedCandidate);
              if (ratio < 0.15 && (!bestMatch || ratio < bestMatch.ratio)) {
                bestMatch = { product: candidate, ratio };
              }
            }

            if (bestMatch) {
              return {
                barcode: product.barcode,
                title: product.title,
                isDuplicate: true,
                matchType: "title",
                existingProduct: bestMatch.product,
                confidence: 1 - bestMatch.ratio,
              };
            }
          }

          // 3. No match
          return {
            barcode: product.barcode,
            title: product.title,
            isDuplicate: false,
            matchType: null,
            confidence: 0,
          };
        } catch (err: any) {
          // Partial failure: mark as unknown
          return {
            barcode: product.barcode,
            title: product.title,
            isDuplicate: false,
            matchType: null,
            confidence: -1, // -1 signals error
          };
        }
      })
    );

    results.push(...batchResults);
  }

  return results;
}
```

- [ ] **Step 6: Verify build compiles**

Run: `npm run build`
Expected: No TypeScript errors in `src/lib/shopify-client.ts`

- [ ] **Step 7: Commit**

```bash
git add src/lib/shopify-client.ts
git commit -m "feat: add Shopify GraphQL client with connection test, dedupe, and Levenshtein"
```

---

### Task 2: Create Test Connection API Route

**Files:**
- Create: `src/app/api/shopify/test-connection/route.ts`

- [ ] **Step 1: Create the directory and route file**

```typescript
// src/app/api/shopify/test-connection/route.ts
import { NextResponse } from "next/server";
import { testShopifyConnection } from "@/lib/shopify-client";

export async function POST(req: Request) {
  try {
    const { shopDomain, accessToken, apiVersion } = await req.json();

    if (!shopDomain || !accessToken || !apiVersion) {
      return NextResponse.json(
        { success: false, error: "Faltan campos requeridos: shopDomain, accessToken, apiVersion" },
        { status: 400 }
      );
    }

    const result = await testShopifyConnection({
      shopDomain,
      accessToken,
      apiVersion,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify build compiles**

Run: `npm run build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/shopify/test-connection/route.ts
git commit -m "feat: add /api/shopify/test-connection API route"
```

---

### Task 3: Create Dedupe API Route

**Files:**
- Create: `src/app/api/shopify/dedupe/route.ts`

- [ ] **Step 1: Create the directory and route file**

```typescript
// src/app/api/shopify/dedupe/route.ts
import { NextResponse } from "next/server";
import { checkDuplicates } from "@/lib/shopify-client";

// Allow up to 2 minutes for large product sets
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const { shopDomain, accessToken, apiVersion, products } = await req.json();

    if (!shopDomain || !accessToken || !apiVersion) {
      return NextResponse.json(
        { success: false, error: "Faltan credenciales de Shopify" },
        { status: 400 }
      );
    }

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { success: false, error: "No se proporcionaron productos para verificar" },
        { status: 400 }
      );
    }

    const results = await checkDuplicates(
      { shopDomain, accessToken, apiVersion },
      products
    );

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Error durante la verificación de duplicados" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify build compiles**

Run: `npm run build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/shopify/dedupe/route.ts
git commit -m "feat: add /api/shopify/dedupe API route with batching"
```

---

### Task 4: Add Shopify Dedupe Fields to ProcessedProduct

**Files:**
- Modify: `src/lib/product-processor.ts:14-58` (ProcessedProduct interface)

- [ ] **Step 1: Add 4 optional fields to ProcessedProduct interface**

Add these fields right after the `modelUsed?: string;` line (before the closing `}` of the interface):

```typescript
  // Shopify live dedupe results (populated after "Verificar Duplicados" action)
  shopifyDupeMatchType?: "barcode" | "title" | null;
  shopifyDupeExistingTitle?: string;
  shopifyDupeExistingId?: string;
  shopifyDupeConfidence?: number;
```

- [ ] **Step 2: Verify build compiles**

Run: `npm run build`
Expected: No errors (fields are optional so no existing code breaks)

- [ ] **Step 3: Commit**

```bash
git add src/lib/product-processor.ts
git commit -m "feat: add Shopify dedupe fields to ProcessedProduct interface"
```

---

## Chunk 2: Settings Dialog + UI Integration

### Task 5: Enhance Settings Dialog with Shopify Tab

**Files:**
- Modify: `src/components/settings-dialog.tsx`

This is the largest UI change. The existing dialog (single form for AI settings) becomes a tabbed dialog with "IA" and "Shopify" tabs.

- [ ] **Step 1: Add imports for Tabs and new icons**

At the top of `settings-dialog.tsx`, update imports:

```typescript
import * as React from "react"
import { Settings, Save, Eye, EyeOff, Loader2, CheckCircle, XCircle, Store } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
```

- [ ] **Step 2: Add Shopify state variables and load from localStorage**

Inside the `SettingsDialog` component, after the existing state declarations (line 22), add:

```typescript
  // Shopify settings state
  const [shopDomain, setShopDomain] = React.useState("")
  const [shopAccessToken, setShopAccessToken] = React.useState("")
  const [shopApiVersion, setShopApiVersion] = React.useState("2025-01")
  const [shopProfileName, setShopProfileName] = React.useState("")
  const [shopOutputMode, setShopOutputMode] = React.useState("csv_only")
  const [showShopToken, setShowShopToken] = React.useState(false)

  // Connection test state
  const [connectionStatus, setConnectionStatus] = React.useState<"idle" | "testing" | "connected" | "error">("idle")
  const [connectionInfo, setConnectionInfo] = React.useState("")
```

In the existing `useEffect` (that loads settings when dialog opens), add after the AI settings loading:

```typescript
      // Load Shopify settings
      const storedDomain = localStorage.getItem("shopify_shop_domain") || ""
      const storedToken = localStorage.getItem("shopify_access_token") || ""
      const storedVersion = localStorage.getItem("shopify_api_version") || "2025-01"
      const storedProfile = localStorage.getItem("shopify_profile_name") || ""
      const storedMode = localStorage.getItem("shopify_output_mode") || "csv_only"
      setShopDomain(storedDomain)
      setShopAccessToken(storedToken)
      setShopApiVersion(storedVersion)
      setShopProfileName(storedProfile)
      setShopOutputMode(storedMode)

      // Reset connection status on open
      const wasConnected = localStorage.getItem("shopify_connected") === "true"
      setConnectionStatus(wasConnected ? "connected" : "idle")
      setConnectionInfo(wasConnected ? "Conectado previamente" : "")
```

- [ ] **Step 3: Update handleSave to persist Shopify settings**

Replace the existing `handleSave` function:

```typescript
  const handleSave = () => {
    // Save AI settings
    localStorage.setItem("ai_provider", provider)
    localStorage.setItem("ai_api_key", apiKey)
    localStorage.setItem("ai_model_version", modelVersion)

    // Save Shopify settings
    localStorage.setItem("shopify_shop_domain", shopDomain)
    localStorage.setItem("shopify_access_token", shopAccessToken)
    localStorage.setItem("shopify_api_version", shopApiVersion)
    localStorage.setItem("shopify_profile_name", shopProfileName)
    localStorage.setItem("shopify_output_mode", shopOutputMode)

    setOpen(false)
    alert("✅ Configuración guardada.")
  }
```

- [ ] **Step 4: Add handleTestConnection function**

After `handleSave`, add:

```typescript
  const handleTestConnection = async () => {
    if (!shopDomain || !shopAccessToken) {
      setConnectionStatus("error")
      setConnectionInfo("Ingresa el dominio y el token de acceso")
      return
    }

    setConnectionStatus("testing")
    setConnectionInfo("Conectando...")

    try {
      const res = await fetch("/api/shopify/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopDomain,
          accessToken: shopAccessToken,
          apiVersion: shopApiVersion,
        }),
      })

      const data = await res.json()

      if (data.success) {
        setConnectionStatus("connected")
        setConnectionInfo(`${data.shop.name} — ${data.shop.domain}`)
        localStorage.setItem("shopify_connected", "true")
      } else {
        setConnectionStatus("error")
        setConnectionInfo(data.error || "Error de conexión")
        localStorage.setItem("shopify_connected", "false")
      }
    } catch (err: any) {
      setConnectionStatus("error")
      setConnectionInfo(err.message || "No se puede conectar")
      localStorage.setItem("shopify_connected", "false")
    }
  }
```

- [ ] **Step 5: Rewrite the dialog body with tabs**

Replace ONLY the `<DialogContent>...</DialogContent>` block (lines 52-137 of the original file) with the tabbed version below. Keep the surrounding `<Dialog>` wrapper and `<DialogTrigger>` intact. The dialog width changes from `sm:max-w-[425px]` to `sm:max-w-[550px]`:

```tsx
      <DialogContent className="sm:max-w-[550px] rounded-2xl">
        <DialogHeader>
          <DialogTitle>Configuración</DialogTitle>
          <DialogDescription>
            Configura tu IA y conexión a Shopify. Los datos se guardan en tu navegador.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="ia" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="ia" className="flex-1">IA</TabsTrigger>
            <TabsTrigger value="shopify" className="flex-1">
              <Store className="w-4 h-4 mr-1.5" />
              Shopify
            </TabsTrigger>
          </TabsList>

          {/* IA Tab — existing content */}
          <TabsContent value="ia">
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="provider" className="text-right text-[#1A1A1A]">
                  Modelo
                </Label>
                <div className="col-span-3">
                    <select
                        id="provider"
                        value={provider}
                        onChange={(e) => setProvider(e.target.value)}
                        className="flex h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#D6F45B] focus:shadow-[0_0_0_2px_rgba(214,244,91,0.2)] disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-250"
                    >
                        <option value="gemini">Google Gemini (Recomendado)</option>
                        <option value="openai">OpenAI (ChatGPT)</option>
                    </select>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="api-key" className="text-right text-[#1A1A1A]">
                  API Key
                </Label>
                <div className="col-span-3 relative">
                    <Input
                      id="api-key"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      type={showApiKey ? "text" : "password"}
                      className="pr-10"
                      placeholder={provider === "gemini" ? "AIzaSy... (Dejar vacío para usar .env)" : "sk-... (Dejar vacío para usar .env)"}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? (
                        <EyeOff className="h-4 w-4 text-[#8C8C8C]" />
                      ) : (
                        <Eye className="h-4 w-4 text-[#8C8C8C]" />
                      )}
                    </Button>
                </div>
                <p className="text-[10px] text-[#8C8C8C] col-span-4 text-right">
                  {apiKey && apiKey.length > 4
                    ? `Key actual: ••••••••${apiKey.slice(-4)}`
                    : "Si se deja vacío, se utilizará la API Key configurada en el servidor (.env)"}
                </p>
              </div>

              {provider === "gemini" && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="model-version" className="text-right text-[#1A1A1A]">
                    Versión
                  </Label>
                  <div className="col-span-3">
                      <select
                          id="model-version"
                          value={modelVersion}
                          onChange={(e) => setModelVersion(e.target.value)}
                          className="flex h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#D6F45B] focus:shadow-[0_0_0_2px_rgba(214,244,91,0.2)] disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-250"
                      >
                          <option value="gemini-2.5-flash">Gemini 2.5 Flash (Stable - Recomendado)</option>
                          <option value="gemini-3-flash-preview">Gemini 3.0 Flash (Preview - ¡Nuevo!)</option>
                          <option value="gemini-2.0-flash">Gemini 2.0 Flash (Legacy)</option>
                          <option value="gemini-1.5-flash-latest">Gemini 1.5 Flash (Deprecated)</option>
                      </select>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Shopify Tab — new */}
          <TabsContent value="shopify">
            <div className="grid gap-4 py-4">
              {/* Profile Name */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="shop-profile" className="text-right text-[#1A1A1A]">
                  Perfil
                </Label>
                <div className="col-span-3">
                  <Input
                    id="shop-profile"
                    value={shopProfileName}
                    onChange={(e) => setShopProfileName(e.target.value)}
                    placeholder="Mi Tienda Principal"
                  />
                </div>
              </div>

              {/* Shop Domain */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="shop-domain" className="text-right text-[#1A1A1A]">
                  Dominio
                </Label>
                <div className="col-span-3">
                  <Input
                    id="shop-domain"
                    value={shopDomain}
                    onChange={(e) => setShopDomain(e.target.value)}
                    placeholder="tu-tienda.myshopify.com"
                  />
                </div>
              </div>

              {/* Access Token */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="shop-token" className="text-right text-[#1A1A1A]">
                  Token
                </Label>
                <div className="col-span-3 relative">
                  <Input
                    id="shop-token"
                    value={shopAccessToken}
                    onChange={(e) => setShopAccessToken(e.target.value)}
                    type={showShopToken ? "text" : "password"}
                    className="pr-10"
                    placeholder="shpat_xxx..."
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowShopToken(!showShopToken)}
                  >
                    {showShopToken ? (
                      <EyeOff className="h-4 w-4 text-[#8C8C8C]" />
                    ) : (
                      <Eye className="h-4 w-4 text-[#8C8C8C]" />
                    )}
                  </Button>
                </div>
                <p className="text-[10px] text-[#8C8C8C] col-span-4 text-right">
                  {shopAccessToken && shopAccessToken.length > 4
                    ? `Token: ••••••••${shopAccessToken.slice(-4)}`
                    : "Admin API access token de tu app Shopify"}
                </p>
              </div>

              {/* API Version */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="shop-version" className="text-right text-[#1A1A1A]">
                  API Ver.
                </Label>
                <div className="col-span-3">
                  <select
                    id="shop-version"
                    value={shopApiVersion}
                    onChange={(e) => setShopApiVersion(e.target.value)}
                    className="flex h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#D6F45B] focus:shadow-[0_0_0_2px_rgba(214,244,91,0.2)] disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-250"
                  >
                    <option value="2025-01">2025-01 (Recomendado)</option>
                    <option value="2024-10">2024-10</option>
                    <option value="2024-07">2024-07</option>
                  </select>
                </div>
              </div>

              {/* Test Connection */}
              <div className="grid grid-cols-4 items-center gap-4">
                <div className="col-start-2 col-span-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={connectionStatus === "testing"}
                    className="w-full"
                  >
                    {connectionStatus === "testing" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {connectionStatus === "connected" && <CheckCircle className="w-4 h-4 mr-2 text-green-500" />}
                    {connectionStatus === "error" && <XCircle className="w-4 h-4 mr-2 text-red-500" />}
                    {connectionStatus === "idle" && <Store className="w-4 h-4 mr-2" />}
                    Test Connection
                  </Button>
                  {connectionInfo && (
                    <p className={`text-[11px] mt-1.5 ${connectionStatus === "error" ? "text-red-500" : "text-green-600"}`}>
                      {connectionInfo}
                    </p>
                  )}
                </div>
              </div>

              {/* Output Mode */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right text-[#1A1A1A]">
                  Modo
                </Label>
                <div className="col-span-3 space-y-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="outputMode"
                      value="csv_only"
                      checked={shopOutputMode === "csv_only"}
                      onChange={(e) => setShopOutputMode(e.target.value)}
                      className="accent-[#D6F45B]"
                    />
                    Solo CSV (actual)
                  </label>
                  <label className="flex items-center gap-2 text-sm text-[#8C8C8C] cursor-not-allowed">
                    <input type="radio" name="outputMode" disabled className="accent-[#D6F45B]" />
                    Solo Shopify Live
                    <span className="text-[10px] bg-[#EBEBEB] px-1.5 py-0.5 rounded">Ciclo 2</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-[#8C8C8C] cursor-not-allowed">
                    <input type="radio" name="outputMode" disabled className="accent-[#D6F45B]" />
                    CSV + Shopify Live
                    <span className="text-[10px] bg-[#EBEBEB] px-1.5 py-0.5 rounded">Ciclo 2</span>
                  </label>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button onClick={handleSave}>
             <Save className="w-4 h-4 mr-2" />
             Guardar Cambios
          </Button>
        </DialogFooter>
      </DialogContent>
```

- [ ] **Step 6: Verify build compiles**

Run: `npm run build`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/components/settings-dialog.tsx
git commit -m "feat: add Shopify tab to settings dialog with credentials and test connection"
```

---

### Task 6: Add Shopify Connection Status Indicator

**Files:**
- Modify: `src/app/page.tsx:358` (near SettingsDialog)

- [ ] **Step 1: Add connection indicator state and effect**

In the `Dashboard` component in `page.tsx` (the default export), add state for the Shopify connection status. Find where other state is declared and add:

```typescript
  const [shopifyConnected, setShopifyConnected] = React.useState(false)

  // Check Shopify connection status on mount and when products change
  React.useEffect(() => {
    setShopifyConnected(localStorage.getItem("shopify_connected") === "true")
  }, [])
```

- [ ] **Step 2: Add green dot indicator next to SettingsDialog**

Find the line `<SettingsDialog />` (~line 358) and wrap it with a relative container + dot:

```tsx
            <div className="relative">
              <SettingsDialog />
              {shopifyConnected && (
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-white" />
              )}
            </div>
```

- [ ] **Step 3: Verify build compiles**

Run: `npm run build`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add green dot indicator for active Shopify connection"
```

---

### Task 7: Add "Verificar Duplicados en Shopify" Button and Badges to Products Table

**Files:**
- Modify: `src/components/products-table.tsx`

- [ ] **Step 1: Add Shopify dedupe state and handler in ProductsTable**

At the top of the `ProductsTable` component (after the `reviewProductId` state), add:

```typescript
  const [isCheckingDupes, setIsCheckingDupes] = React.useState(false)
  const [dupeCheckProgress, setDupeCheckProgress] = React.useState("")
  const [shopifyConfigured, setShopifyConfigured] = React.useState(false)

  React.useEffect(() => {
    setShopifyConfigured(localStorage.getItem("shopify_connected") === "true")
  }, [])

  const handleCheckShopifyDupes = async () => {
    setIsCheckingDupes(true)
    setDupeCheckProgress(`0/${products.length}`)
    try {
      const shopDomain = localStorage.getItem("shopify_shop_domain") || ""
      const accessToken = localStorage.getItem("shopify_access_token") || ""
      const apiVersion = localStorage.getItem("shopify_api_version") || "2025-01"

      const productsToCheck = products.map((p) => ({
        barcode: p.barcode,
        title: p.generatedTitle || p.title,
      }))

      const res = await fetch("/api/shopify/dedupe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopDomain,
          accessToken,
          apiVersion,
          products: productsToCheck,
        }),
      })

      const data = await res.json()

      if (data.success && data.results) {
        // Use index-based matching (API preserves order) to avoid issues
        // when multiple products have empty barcodes
        data.results.forEach((result: any, index: number) => {
          setDupeCheckProgress(`${index + 1}/${products.length}`)
          const product = products[index]
          if (!product) return
          const updates: Partial<import("@/lib/product-processor").ProcessedProduct> = {
            shopifyDupeMatchType: result.matchType,
            shopifyDupeConfidence: result.confidence,
          }
          if (result.existingProduct) {
            updates.shopifyDupeExistingTitle = result.existingProduct.title
            updates.shopifyDupeExistingId = result.existingProduct.id
          }
          if (result.isDuplicate) {
            updates.isChecked = false
          }
          onUpdateProduct(product.id, updates)
        })
      }
    } catch (err) {
      console.error("Error checking Shopify duplicates:", err)
    } finally {
      setIsCheckingDupes(false)
    }
  }
```

- [ ] **Step 2: Add the "Verificar Duplicados" button in the toolbar area**

Find the info bar that starts with `<div className="flex items-center gap-2 text-xs text-[#1A1A1A] bg-[#D6F45B]/10 ...">` and add a button section right after it (but still inside the `<div className="space-y-4">` wrapper):

```tsx
      {/* Shopify Dedupe Button */}
      {shopifyConfigured && (
        <div className="flex items-center justify-between bg-[#F5F6F7] p-3 rounded-xl border border-[#E5E7EB]">
          <div className="flex items-center gap-2 text-xs text-[#8C8C8C]">
            <Store className="h-3.5 w-3.5" />
            Verificar duplicados contra tu tienda Shopify
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCheckShopifyDupes}
            disabled={isCheckingDupes}
            className="text-xs"
          >
            {isCheckingDupes ? (
              <>
                <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                Verificando {dupeCheckProgress}...
              </>
            ) : (
              <>
                <Search className="w-3 h-3 mr-1.5" />
                Verificar Duplicados
              </>
            )}
          </Button>
        </div>
      )}
```

Add `Store` to the lucide-react import at the top of the file:

```typescript
import { Check, AlertCircle, Loader2, Settings2, ExternalLink, Search, Sparkles, Image as ImageIcon, Store } from "lucide-react"
```

- [ ] **Step 3: Add Shopify dedupe badge in each table row**

In the desktop table, find where the product status badge is rendered (the `<Badge>` element showing "Pendiente"/"Completo"/"Error"). Right after it (or in the same cell), add a Shopify dedupe indicator:

```tsx
                    {/* Shopify Dedupe Badge */}
                    {product.shopifyDupeMatchType && (
                      <Badge variant="destructive" className="text-[10px] ml-1">
                        Duplicado ({product.shopifyDupeMatchType === "barcode" ? "código" : "título"})
                      </Badge>
                    )}
                    {product.shopifyDupeMatchType === null && product.shopifyDupeConfidence !== undefined && product.shopifyDupeConfidence >= 0 && (
                      <Badge className="text-[10px] ml-1 bg-green-100 text-green-700 hover:bg-green-100">
                        Nuevo
                      </Badge>
                    )}
                    {product.shopifyDupeConfidence === -1 && (
                      <Badge className="text-[10px] ml-1 bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
                        Desconocido
                      </Badge>
                    )}
```

If `shopifyDupeExistingTitle` exists, show it as a small tooltip or text under the badge:

```tsx
                    {product.shopifyDupeExistingTitle && (
                      <p className="text-[9px] text-red-400 mt-0.5 truncate max-w-[150px]" title={product.shopifyDupeExistingTitle}>
                        Ya existe: {product.shopifyDupeExistingTitle}
                      </p>
                    )}
```

Do the same in the mobile card view where the product status is shown.

- [ ] **Step 4: Verify build compiles**

Run: `npm run build`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/components/products-table.tsx
git commit -m "feat: add Shopify dedupe button and duplicate badges to products table"
```

---

### Task 8: Final Build Verification and Manual Test

- [ ] **Step 1: Full build check**

Run: `npm run build`
Expected: Build succeeds with 0 errors

- [ ] **Step 2: Manual test checklist (run `npm run dev` and verify in browser)**

1. Open Settings → verify two tabs: "IA" and "Shopify"
2. IA tab → all existing fields work as before
3. Shopify tab → enter domain `nuraromas.myshopify.com`, token, API version `2025-01`
4. Click "Test Connection" → should show spinner then green check with shop name
5. Click "Guardar Cambios" → settings persisted (close and reopen to verify)
6. Green dot appears next to the gear icon on the main page
7. Load a CSV with products → "Verificar Duplicados" button appears
8. Click "Verificar Duplicados" → spinner, then badges appear (Nuevo/Duplicado)
9. Duplicate products get unchecked automatically
10. All existing functionality works: CSV export, AI generation, manual entry

- [ ] **Step 3: Final commit if any adjustments needed**

```bash
git add -A
git commit -m "fix: adjustments from manual testing"
```

// Shopify GraphQL Client — shared client for connection testing, product lookup, and deduplication.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShopifyClientConfig {
  shopDomain: string;
  accessToken: string;
  apiVersion: string;
}

export interface ShopifyGraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string; locations?: Array<{ line: number; column: number }>; path?: string[] }>;
  extensions?: Record<string, unknown>;
}

export interface DedupeResult {
  barcode: string;
  title: string;
  isDuplicate: boolean;
  matchType: "barcode" | "title" | null;
  existingProduct?: { id: string; title: string; handle: string };
  confidence: number;
}

export interface ShopInfo {
  name: string;
  email: string;
  domain: string;
  productsCount: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Normalize a title for fuzzy search comparison.
 * Lower-cases, strips diacritics (NFD + remove combining marks), preserves
 * spaces, and trims. This intentionally differs from csv-exporter's normalize
 * which strips all non-alphanumeric characters.
 */
export function normalizeForSearch(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Compute the Levenshtein edit-distance between two strings and return a
 * normalised ratio in the range [0, 1] where 0 means identical and 1 means
 * completely different.
 */
export function levenshteinRatio(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0 || b.length === 0) return 1;

  const rows = a.length + 1;
  const cols = b.length + 1;

  // Use two rows instead of full matrix for memory efficiency.
  let prev = new Array<number>(cols);
  let curr = new Array<number>(cols);

  for (let j = 0; j < cols; j++) prev[j] = j;

  for (let i = 1; i < rows; i++) {
    curr[0] = i;
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,     // insertion
        prev[j] + 1,         // deletion
        prev[j - 1] + cost,  // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  const distance = prev[cols - 1];
  return distance / Math.max(a.length, b.length);
}

// ---------------------------------------------------------------------------
// GraphQL transport
// ---------------------------------------------------------------------------

/**
 * Execute a GraphQL query against the Shopify Admin API.
 * Automatically retries on HTTP 429 with exponential back-off (1 s, 2 s, 4 s)
 * up to 3 retries, respecting the Retry-After header when present.
 */
export async function shopifyGraphQL<T>(
  config: ShopifyClientConfig,
  query: string,
  variables?: Record<string, unknown>,
): Promise<ShopifyGraphQLResponse<T>> {
  const url = `https://${config.shopDomain}/admin/api/${config.apiVersion}/graphql.json`;
  const maxRetries = 3;
  const baseDelay = 1000; // 1 second

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": config.accessToken,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (response.status === 429 && attempt < maxRetries) {
      const retryAfter = response.headers.get("Retry-After");
      const delayMs = retryAfter
        ? parseFloat(retryAfter) * 1000
        : baseDelay * Math.pow(2, attempt); // 1s, 2s, 4s
      await sleep(delayMs);
      continue;
    }

    if (!response.ok) {
      throw new Error(
        `Shopify GraphQL request failed: ${response.status} ${response.statusText}`,
      );
    }

    return (await response.json()) as ShopifyGraphQLResponse<T>;
  }

  // Unreachable in practice — the loop always returns or throws — but
  // satisfies the TypeScript control-flow checker.
  throw new Error("Shopify GraphQL request failed after maximum retries");
}

// ---------------------------------------------------------------------------
// Connection test
// ---------------------------------------------------------------------------

interface ShopQueryData {
  shop: {
    name: string;
    email: string;
    primaryDomain: { url: string };
  };
  productsCount?: {
    count?: number;
  };
}

/**
 * Verify the Shopify connection by querying basic shop information.
 */
export async function testShopifyConnection(
  config: ShopifyClientConfig,
): Promise<{ success: true; shop: ShopInfo } | { success: false; error: string }> {
  try {
    const result = await shopifyGraphQL<ShopQueryData>(
      config,
      `{ shop { name email primaryDomain { url } } productsCount { count } }`,
    );

    if (result.errors?.length) {
      return { success: false, error: result.errors.map((e) => e.message).join("; ") };
    }

    if (!result.data?.shop) {
      return { success: false, error: "No shop data returned" };
    }

    const { name, email, primaryDomain } = result.data.shop;
    const productsCount = result.data.productsCount?.count ?? 0;
    return {
      success: true,
      shop: { name, email, domain: primaryDomain.url, productsCount },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Product lookup
// ---------------------------------------------------------------------------

interface VariantsQueryData {
  productVariants: {
    edges: Array<{
      node: {
        id: string;
        barcode: string | null;
        product: { id: string; title: string; handle: string };
      };
    }>;
  };
}

/**
 * Find a product by its barcode via variant lookup.
 */
export async function findProductByBarcode(
  config: ShopifyClientConfig,
  barcode: string,
): Promise<{ id: string; title: string; handle: string } | null> {
  const query = `
    query findByBarcode($barcodeQuery: String!) {
      productVariants(first: 1, query: $barcodeQuery) {
        edges {
          node {
            id
            barcode
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

  const result = await shopifyGraphQL<VariantsQueryData>(config, query, {
    barcodeQuery: `barcode:${barcode}`,
  });

  const edge = result.data?.productVariants?.edges?.[0];
  if (!edge) return null;

  const { id, title, handle } = edge.node.product;
  return { id, title, handle };
}

interface ProductsQueryData {
  products: {
    edges: Array<{
      node: { id: string; title: string; handle: string };
    }>;
  };
}

/**
 * Find products whose title matches the given search string (normalised).
 */
export async function findProductsByTitle(
  config: ShopifyClientConfig,
  title: string,
  first: number = 5,
): Promise<Array<{ id: string; title: string; handle: string }>> {
  const normalised = normalizeForSearch(title);

  const query = `
    query findByTitle($query: String!, $first: Int!) {
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

  const result = await shopifyGraphQL<ProductsQueryData>(config, query, {
    query: normalised,
    first,
  });

  return (
    result.data?.products?.edges?.map((e) => ({
      id: e.node.id,
      title: e.node.title,
      handle: e.node.handle,
    })) ?? []
  );
}

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

const DUPLICATE_THRESHOLD = 0.15;
const BATCH_SIZE = 10;

/**
 * Check an array of candidate products for duplicates already in the Shopify
 * store. Processes in batches of 10 (parallel within each batch, sequential
 * across batches).
 */
export async function checkDuplicates(
  config: ShopifyClientConfig,
  products: Array<{ barcode: string; title: string }>,
): Promise<DedupeResult[]> {
  const results: DedupeResult[] = [];

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map(async (product): Promise<DedupeResult> => {
        try {
          // 1. Try barcode match first
          if (product.barcode) {
            const barcodeMatch = await findProductByBarcode(config, product.barcode);
            if (barcodeMatch) {
              return {
                barcode: product.barcode,
                title: product.title,
                isDuplicate: true,
                matchType: "barcode",
                existingProduct: barcodeMatch,
                confidence: 1.0,
              };
            }
          }

          // 2. Fall back to fuzzy title match
          const titleMatches = await findProductsByTitle(config, product.title);
          const normalisedInput = normalizeForSearch(product.title);

          for (const candidate of titleMatches) {
            const normalisedCandidate = normalizeForSearch(candidate.title);
            const ratio = levenshteinRatio(normalisedInput, normalisedCandidate);

            if (ratio < DUPLICATE_THRESHOLD) {
              return {
                barcode: product.barcode,
                title: product.title,
                isDuplicate: true,
                matchType: "title",
                existingProduct: candidate,
                confidence: 1 - ratio,
              };
            }
          }

          // No duplicate found
          return {
            barcode: product.barcode,
            title: product.title,
            isDuplicate: false,
            matchType: null,
            confidence: 0,
          };
        } catch {
          return {
            barcode: product.barcode,
            title: product.title,
            isDuplicate: false,
            matchType: null,
            confidence: -1,
          };
        }
      }),
    );

    results.push(...batchResults);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Product Creation (Cycle 2)
// ---------------------------------------------------------------------------

import type { ShopifyProductInput } from "./shopify-mapper";

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
  input: ShopifyProductInput,
): Promise<CreateProductResult> {
  const mutation = `
    mutation productCreate($product: ProductCreateInput!, $media: [CreateMediaInput!]) {
      productCreate(product: $product, media: $media) {
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

  const productInput: Record<string, unknown> = {
    title: input.title,
    descriptionHtml: input.bodyHtml,
    vendor: input.vendor,
    tags: input.tags,
    status: input.status,
    metafields: input.metafields,
  };

  const mediaInput =
    input.images?.map((img) => ({
      mediaContentType: "IMAGE",
      originalSource: img.src,
      alt: img.altText || undefined,
    })) || [];

  try {
    const result = await shopifyGraphQL<{
      productCreate: {
        product: { id: string; handle: string } | null;
        userErrors: Array<{ field: string[]; message: string }>;
      };
    }>(config, mutation, {
      product: productInput,
      media: mediaInput.length > 0 ? mediaInput : undefined,
    });

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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return {
      barcode: input.variants[0]?.barcode || "",
      title: input.title,
      status: "failed",
      error: message,
    };
  }
}

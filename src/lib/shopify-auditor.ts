import { shopifyGraphQL, ShopifyClientConfig } from "./shopify-client";

// ============================================================================
// Types
// ============================================================================

export interface AuditableProduct {
  id: string;
  title: string;
  handle: string;
  bodyHtml: string;
  vendor: string;
  tags: string[];
  productType: string;
  status: string;
  updatedAt: string;
  featuredImage: string;
  variants: Array<{
    id: string;
    title: string;
    barcode: string;
    price: string;
  }>;
  seo: {
    title: string;
    description: string;
  };
}

// ============================================================================
// Funciones de Lectura (Fetcher para la Auditoría)
// ============================================================================

const PRODUCT_FIELDS = `
  id
  title
  handle
  bodyHtml
  vendor
  tags
  productType
  status
  updatedAt
  featuredImage { url }
  seo {
    title
    description
  }
  variants(first: 1) {
    edges {
      node {
        id
        title
        barcode
        price
      }
    }
  }
`;

function mapProduct(node: any): AuditableProduct {
  return {
    id: node.id,
    title: node.title,
    handle: node.handle,
    bodyHtml: node.bodyHtml || "",
    vendor: node.vendor || "",
    tags: node.tags || [],
    productType: node.productType || "",
    status: node.status,
    updatedAt: node.updatedAt || "",
    featuredImage: node.featuredImage?.url || "",
    seo: {
      title: node.seo?.title || "",
      description: node.seo?.description || "",
    },
    variants: node.variants.edges.map((v: any) => ({
      id: v.node.id,
      title: v.node.title,
      barcode: v.node.barcode || "",
      price: v.node.price || "0.00",
    })),
  };
}

/**
 * Trae un lote de productos de Shopify por fecha.
 */
export async function fetchAuditableProducts(
  config: ShopifyClientConfig,
  limit: number = 50,
  cursor: string | null = null
): Promise<{ products: AuditableProduct[]; hasNextPage: boolean; endCursor: string | null; error?: string }> {
  const query = `
    query getProductsForAudit($first: Int!, $after: String) {
      products(first: $first, after: $after, sortKey: UPDATED_AT, reverse: false) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            ${PRODUCT_FIELDS}
          }
        }
      }
    }
  `;

  try {
    const result = await shopifyGraphQL<any>(config, query, {
      first: limit,
      after: cursor,
    });

    if (result.errors?.length) {
      return { products: [], hasNextPage: false, endCursor: null, error: result.errors[0].message };
    }

    const connection = result.data?.products;
    if (!connection) {
       return { products: [], hasNextPage: false, endCursor: null };
    }

    const products: AuditableProduct[] = connection.edges.map((edge: any) => mapProduct(edge.node));

    return {
      products,
      hasNextPage: connection.pageInfo.hasNextPage,
      endCursor: connection.pageInfo.endCursor,
    };
  } catch (error: any) {
    return { products: [], hasNextPage: false, endCursor: null, error: error.message };
  }
}

/**
 * Busca productos por nombre (autocomplete) via GraphQL query filter.
 */
export async function searchProducts(
  config: ShopifyClientConfig,
  searchQuery: string,
  limit: number = 20
): Promise<{ products: AuditableProduct[]; error?: string }> {
  const query = `
    query searchProducts($queryStr: String!, $first: Int!) {
      products(first: $first, query: $queryStr) {
        edges {
          node {
            ${PRODUCT_FIELDS}
          }
        }
      }
    }
  `;

  try {
    const result = await shopifyGraphQL<any>(config, query, {
      queryStr: `title:*${searchQuery}*`,
      first: limit,
    });

    if (result.errors?.length) {
      return { products: [], error: result.errors[0].message };
    }

    const connection = result.data?.products;
    if (!connection) {
       return { products: [] };
    }

    const products: AuditableProduct[] = connection.edges.map((edge: any) => mapProduct(edge.node));
    return { products };
  } catch (error: any) {
    return { products: [], error: error.message };
  }
}

// ============================================================================
// Funciones de Escritura (Actualización en Vivo)
// ============================================================================

export interface ProductUpdateData {
  title?: string;
  bodyHtml?: string;
  seoTitle?: string;
  seoDescription?: string;
  tags?: string[];
}

/**
 * Actualiza el producto directamente en Shopify (Módulo de Auditoría V3).
 */
export async function updateShopifyProduct(
  config: ShopifyClientConfig,
  productId: string,
  updateData: ProductUpdateData
): Promise<{ success: boolean; error?: string }> {
  
  const updateProductMutation = `
    mutation productUpdate($input: ProductInput!) {
      productUpdate(input: $input) {
        product {
          id
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const productInput: Record<string, any> = { id: productId };
  if (updateData.title) productInput.title = updateData.title;
  if (updateData.bodyHtml) productInput.bodyHtml = updateData.bodyHtml;
  if (updateData.tags) productInput.tags = updateData.tags;
  
  if (updateData.seoTitle !== undefined || updateData.seoDescription !== undefined) {
     productInput.seo = {
        title: updateData.seoTitle,
        description: updateData.seoDescription
     };
  }

  try {
    const result = await shopifyGraphQL<any>(config, updateProductMutation, {
      input: productInput
    });

    if (result.errors?.length) {
      return { success: false, error: result.errors[0].message };
    }

    const userErrors = result.data?.productUpdate?.userErrors;
    if (userErrors && userErrors.length > 0) {
      return { success: false, error: userErrors.map((e: any) => e.message).join(", ") };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}


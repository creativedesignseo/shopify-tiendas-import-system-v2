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
 * Cleans a European-formatted price string.
 * "54,00 €" → "54.00"
 */
export function cleanPrice(price: string): string {
  return price.replace("€", "").trim().replace(",", ".");
}

/**
 * Maps a ProcessedProduct into Shopify's productCreate input format.
 */
export function mapProductToShopify(
  product: ProcessedProduct
): ShopifyProductInput {
  const tags = product.tags
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const images = product.images
    .filter((url) => url.length > 0)
    .map((url, index) => ({
      src: url,
      ...(index === 0 ? { altText: product.generatedTitle } : {}),
    }));

  const metafieldKeys = [
    "acorde",
    "genero",
    "notas_salida",
    "ocasion",
    "estacion",
    "aroma",
    "sexo_objetivo",
  ] as const;

  const metafields = metafieldKeys
    .filter((key) => product.metafields[key]?.length > 0)
    .map((key) => ({
      namespace: "custom",
      key,
      value: product.metafields[key],
      type: "single_line_text_field",
    }));

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
        cost: product.costPerItem
          ? cleanPrice(product.costPerItem)
          : undefined,
      },
    ],
    metafields: metafields.length > 0 ? metafields : undefined,
  };
}

/**
 * Validates that a ProcessedProduct has all required fields for Shopify upload.
 * Returns an array of missing field names (empty if valid).
 */
export function validateForShopify(product: ProcessedProduct): string[] {
  const errors: string[] = [];

  if (!product.generatedTitle?.trim()) {
    errors.push("Título");
  }
  if (!product.price?.trim()) {
    errors.push("Precio");
  }
  if (!product.vendor?.trim()) {
    errors.push("Marca");
  }

  return errors;
}

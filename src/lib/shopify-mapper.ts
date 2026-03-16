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
    inventoryQuantity?: number;
    inventoryPolicy?: "DENY" | "CONTINUE";
    weight?: number;
    weightUnit?: string;
    requiresShipping?: boolean;
    taxable?: boolean;
    options?: string[];
    cost?: string;
    showUnitPrice?: boolean;
    unitPriceMeasurement?: {
      measuredType: "VOLUME";
      quantityUnit: "ML";
      quantityValue: number;
      referenceUnit: "ML";
      referenceValue: number;
    };
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
 * "54,00 EUR" -> "54.00"
 */
export function cleanPrice(price: string): string {
  const cleaned = price
    .replace("€", "")
    .replace("â‚¬", "")
    .replace(/\s/g, "")
    .replace(",", ".")
    .trim();
  return cleaned || "0.00";
}

function capitalizeFirstLetter(input: string): string {
  const value = input.trim();
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function parseMlValue(size: string): number {
  const text = (size || "").toLowerCase().replace(",", ".");
  const match = text.match(/(\d+(\.\d+)?)/);
  if (!match) return 100;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : 100;
}

/**
 * Maps a ProcessedProduct into Shopify's productCreate input format.
 */
export function mapProductToShopify(
  product: ProcessedProduct
): ShopifyProductInput {
  const tags = (product.tags || "")
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  const vendorTag = (product.vendor || "").trim();
  if (vendorTag && !tags.some((t) => t.toLowerCase() === vendorTag.toLowerCase())) {
    tags.unshift(vendorTag);
  }

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
    title: capitalizeFirstLetter(product.generatedTitle),
    bodyHtml: product.bodyHtml,
    vendor: product.vendor,
    productType: product.shopifyProductType || "Eau de Parfum",
    tags,
    status: product.shopifyStatus || "ACTIVE",
    seoTitle: product.seoTitle || undefined,
    seoDescription: product.seoDescription || undefined,
    images,
    variants: [
      {
        price: cleanPrice(product.price),
        sku: product.shopifySku || product.barcode || undefined,
        barcode: product.shopifyBarcode || product.barcode || undefined,
        inventoryQuantity: product.shopifyInventoryQuantity ?? 10,
        inventoryPolicy: "DENY",
        weight: product.shopifyWeightGrams ?? 350,
        weightUnit: "GRAMS",
        requiresShipping: product.shopifyRequiresShipping ?? true,
        taxable: product.shopifyTaxable ?? true,
        options: [product.size || "100ml"],
        cost: product.costPerItem
          ? cleanPrice(product.costPerItem)
          : undefined,
        showUnitPrice: true,
        unitPriceMeasurement: {
          measuredType: "VOLUME",
          quantityUnit: "ML",
          quantityValue: parseMlValue(product.size || "100ml"),
          referenceUnit: "ML",
          referenceValue: product.shopifyUnitPriceReferenceValue ?? 1,
        },
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
    errors.push("Titulo");
  }
  if (!product.price?.trim()) {
    errors.push("Precio");
  }
  if (!product.vendor?.trim()) {
    errors.push("Marca");
  }

  return errors;
}

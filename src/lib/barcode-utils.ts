/**
 * Centralized barcode sanitization utility.
 * Handles all known formatting quirks from Excel, Shopify exports, and manual entry.
 */
export const sanitizeBarcode = (raw: string): string => {
  if (!raw) return "";

  let barcode = raw.trim();

  // Strip leading single quote (Excel/Shopify text-formatting prefix)
  if (barcode.startsWith("'")) {
    barcode = barcode.slice(1);
  }

  // Remove internal whitespace
  barcode = barcode.replace(/\s/g, "");

  return barcode;
};

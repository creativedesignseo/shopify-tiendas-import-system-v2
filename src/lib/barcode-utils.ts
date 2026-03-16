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

  // Common Excel export quirk for numeric codes: "6297001158463,00" / "6297001158463.00"
  // Keep alphanumeric barcodes intact (e.g. DESEO0001).
  if (/^[0-9]+([.,]00)?$/.test(barcode)) {
    barcode = barcode.replace(/[.,]00$/, "");
  }

  return barcode;
};

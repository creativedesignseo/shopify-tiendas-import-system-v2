import Papa from "papaparse";
import slugify from "slugify";
import { ProcessedProduct } from "./product-processor";

// Helper to normalize headers for flexible matching
const normalize = (str: string) => 
  str.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

export const generateCSV = (products: ProcessedProduct[], masterHeaders: string[]): string => {
  const rows: any[] = [];

  products.forEach((product) => {
    // 1. Prepare Base Data for Row 1
    const handle = slugify(product.generatedTitle, { lower: true, strict: true });
    
    // Default Values Map (Normalized Keys for easier lookup if needed, but we'll use logic)
    // We keep values as is.
    const getDefaults = (header: string): string | undefined => {
       const h = normalize(header);
       if (h === "published") return "true";
       if (h.includes("productcategory")) return "Health & Beauty > Personal Care > Cosmetics > Perfumes & Colognes > Eaux de Parfum";
       if (h === "type") return "Eau de Parfum";
       if (h.includes("option1name")) return "Tamaño";
       if (h.includes("option1value")) return product.size || "100ml";
       if (h.includes("variantgrams")) return "350.0";
       if (h.includes("tracker")) return "shopify";
       if (h.includes("inventoryqty")) return "10";
       if (h.includes("inventorypolicy")) return "deny";
       if (h.includes("fulfillmentservice")) return "manual";
       if (h.includes("requiresshipping")) return "true";
       if (h.includes("varianttaxable")) return "true";
       // Unit Prices (Shopify specific)
       // We ensure we don't confuse "Unit Price..." (Value) with "...Unit" (Unit of measure)
       const isValue = (h.includes("totalmeasure") || h.includes("basemeasure")) && !h.endsWith("unit");
       const isUnit = (h.includes("totalmeasure") || h.includes("basemeasure")) && h.endsWith("unit");

       if (h.includes("totalmeasure") && isValue) return product.unitPrice.totalMeasure?.toFixed(1) || "";
       if (h.includes("totalmeasure") && isUnit) return product.unitPrice.totalMeasureUnit || "";
       if (h.includes("basemeasure") && isValue) return "1"; 
       if (h.includes("basemeasure") && isUnit) return product.unitPrice.totalMeasureUnit || ""; 
                                                                           
       if (h.includes("giftcard")) return "false";
       if (h.includes("googleproductcategory")) return "479";
       if (h.includes("weightunit")) return "kg";
       if (h === "status") return "active";
       return undefined;
    };

    // Specific Mappings
    // We will look for these in the Loop
    
    // Rows generation
    const row1: Record<string, string> = {};

    masterHeaders.forEach((header) => {
      const h = normalize(header);
      let value = "";

      // 1. Direct Mappings (Flexible)
      const def = getDefaults(header);
      if (def !== undefined) {
        row1[header] = def;
      } else {
        row1[header] = ""; // Ensure all headers are present, even if empty
      }
    });

    // 3. Map internal data to the found CSV headers
    // We explicitly map our internal ProcessedProduct fields to the standard Shopify headers
    // using the fuzzy matching helper to find the actual column name in the provided headers.
    
    // Helper to find the actual header name in the Master CSV
    const findHeader = (target: string): string | undefined => {
        const t = normalize(target);
        return masterHeaders.find(h => {
            const n = normalize(h);
            if (n === t) return true;
            // Fuzzy match for specific complex headers
            if (target === "Body (HTML)" && n.includes("body") && n.includes("html")) return true;
            if (target === "Option1 Name" && n.includes("option1") && n.includes("name")) return true;
            if (target === "Option1 Value" && n.includes("option1") && n.includes("value")) return true;
            if (target === "Image Src" && n.includes("image") && n.includes("src")) return true;
            if (target === "Unit Price Total Measure" && n.includes("total") && n.includes("measure") && !n.endsWith("unit")) return true;
            if (target === "Unit Price Total Measure Unit" && n.includes("total") && n.includes("measure") && n.endsWith("unit")) return true;
            if (target === "Unit Price Base Measure" && n.includes("base") && n.includes("measure") && !n.endsWith("unit")) return true;
            if (target === "Unit Price Base Measure Unit" && n.includes("base") && n.includes("measure") && n.endsWith("unit")) return true;
            if (target === "Variant Barcode" && n.includes("variant") && n.includes("barcode")) return true;
            return false;
        });
    };

    const mapField = (standardName: string, value: any) => {
      const actualHeader = findHeader(standardName);
      if (actualHeader) {
        row1[actualHeader] = String(value || ""); // Ensure value is a string
      }
    };

    // Core Fields
    mapField("Handle", handle); // Handle is always explicitly set
    mapField("Title", product.generatedTitle);
    mapField("Body (HTML)", product.bodyHtml);
    mapField("Vendor", product.vendor);
    mapField("Type", "Eau de Parfum"); // Default type if not present
    mapField("Tags", product.tags);
    mapField("Published", "true");
    mapField("Option1 Name", "Tamaño");
    mapField("Option1 Value", product.size || "100ml");
    mapField("Variant SKU", product.barcode || ""); // Using barcode as SKU fallback
    mapField("Variant Grams", "350.0");
    mapField("Variant Inventory Tracker", "shopify");
    mapField("Variant Inventory Qty", "10"); // Default stock
    mapField("Variant Inventory Policy", "deny");
    mapField("Variant Price", product.price);
    mapField("Variant Requires Shipping", "true");
    mapField("Variant Taxable", "true");
    mapField("Gift Card", "false");
    mapField("Google Shopping / Google Product Category", "479");
    mapField("Variant Weight Unit", "kg");
    mapField("Status", "active");

    // Unit Prices
    mapField("Unit Price Total Measure", product.unitPrice.totalMeasure.toFixed(1));
    mapField("Unit Price Total Measure Unit", product.unitPrice.totalMeasureUnit);
    mapField("Unit Price Base Measure", "1");
    mapField("Unit Price Base Measure Unit", product.unitPrice.totalMeasureUnit);
    
    // Barcode
    const cleanBarcode = product.barcode.startsWith("'") ? product.barcode.slice(1) : product.barcode;
    mapField("Variant Barcode", cleanBarcode);
    
    // SEO
    mapField("SEO Title", product.seoTitle);
    mapField("SEO Description", product.seoDescription);

    // Metafields
    // Note: These keys must match EXACTLY what's in the Master CSV for correct import
    // We use the fuzzy finder to locate them.
    mapField("Acorde", product.metafields.acorde);
    mapField("Género", product.metafields.genero);
    mapField("Notas de salida", product.metafields.notas_salida);
    mapField("Ocasión", product.metafields.ocasion);
    mapField("Estación", product.metafields.estacion);
    mapField("Aroma", product.metafields.aroma);
    mapField("Sexo objetivo", product.metafields.sexo_objetivo);

    // Images (First Image goes in the main row)
    if (product.images && product.images.length > 0) {
      mapField("Image Src", product.images[0]);
      mapField("Image Position", "1");
      mapField("Image Alt Text", product.generatedTitle);
    }

    rows.push(row1);

    // 2. Handle Additional Images (Rows 2+)
    if (product.images.length > 1) {
      for (let i = 1; i < product.images.length; i++) {
        const imageRow: Record<string, string> = {};
        
        masterHeaders.forEach(header => {
            imageRow[header] = ""; 
            const h = normalize(header);
            if (h === "handle") imageRow[header] = handle;
            if (h.includes("imagesrc")) imageRow[header] = product.images[i];
            if (h.includes("imageposition")) imageRow[header] = (i + 1).toString();
            if (h.includes("imagealt")) imageRow[header] = product.generatedTitle;
        });

        rows.push(imageRow);
      }
    }
  });

  return Papa.unparse({
    fields: masterHeaders,
    data: rows,
  });
};

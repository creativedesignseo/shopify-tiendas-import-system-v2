import Papa from "papaparse";
import { MasterData } from "./csv-parser";
import { sanitizeBarcode } from "./barcode-utils";

export interface NewProductRaw {
  Nombre: string;
  Marca: string;
  "Precio (EUR)": string;
  "Código de barras": string;
  Tamaño: string; // e.g. "100 ml"
  [key: string]: string;
}

export interface ProcessedProduct {
  id: string; // generated UUID or barcode
  title: string; // Initial: from Nombre
  vendor: string; // from Marca
  price: string; // from Precio (EUR)
  barcode: string; // from Código de barras
  size: string; // from Tamaño
  costPerItem: string; // from Cost per item (precio de costo)

  // AI Generated / Editable Fields
  generatedTitle: string;
  bodyHtml: string; // Preview
  tags: string;
  images: string[]; // [url1, url2]
  seoTitle: string;
  seoDescription: string;
  
  // Metafields (AI)
  metafields: {
    acorde: string;
    genero: string;
    notas_salida: string;
    ocasion: string;
    estacion: string;
    aroma: string;
    sexo_objetivo: string;
    // Add others if needed
  };

  // Calculated
  unitPrice: {
    totalMeasure: number;
    totalMeasureUnit: string;
    baseMeasure: number;
    baseMeasureUnit: string;
    isValid: boolean;
  };

  // Status
  isDuplicate: boolean;
  isChecked: boolean;
  status: "pending" | "generating" | "complete" | "error";
  observation?: string;
  errorDetails?: string;
  modelUsed?: string;

  // Shopify editable params (per product)
  shopifySku?: string;
  shopifyBarcode?: string;
  shopifyInventoryQuantity?: number;
  shopifyWeightGrams?: number;
  shopifyRequiresShipping?: boolean;
  shopifyTaxable?: boolean;
  shopifyStatus?: "ACTIVE" | "DRAFT";
  shopifyProductType?: string;
  shopifyUnitPriceReferenceValue?: number;

  // Shopify live dedupe results (populated after "Verificar Duplicados" action)
  shopifyDupeMatchType?: "barcode" | "title" | null;
  shopifyDupeExistingTitle?: string;
  shopifyDupeExistingId?: string;
  shopifyDupeConfidence?: number;
}

export const calculateUnitPrice = (sizeStr: string) => {
  // Normalize: "100 ml" -> "100ml", "100  ML" -> "100ml"
  const normalized = sizeStr.toLowerCase().replace(/\s/g, "");
  
  // Regex to capture number and unit
  const match = normalized.match(/^(\d+(?:\.\d+)?)([a-z]+)$/);

  if (!match) {
    return {
      totalMeasure: 0,
      totalMeasureUnit: "",
      baseMeasure: 1,
      baseMeasureUnit: "",
      isValid: false,
    };
  }

  const value = parseFloat(match[1]);
  const unit = match[2]; // ml, g, kg, l

  // Logic: 
  // If unit is 'ml' or 'g', base is usually 100 or 1 depending on Shopify standard.
  // Implementation Plan said: "Unit Price Base Measure: 1", "Unit Price Base Measure Unit: ml" (or kg/l).
  // Actually usually it's per 100ml or per 1 item.
  // Let's stick to the plan: Base=1, Unit=ml (or whatever unit is passed).
  
  return {
    totalMeasure: value,
    totalMeasureUnit: unit,
    baseMeasure: 1, // Standardizing to price per 1 unit (e.g. per 1 ml). 
                    // WAIT. Users often want price per 100ml. 
                    // Checks Plan: "standardizes calculations based on 100ml"
                    // Example: 100ml product. Total=100, Unit=ml. Base=100??
                    // Let's look at Shopify docs standard. 
                    // Usually: Total=100, Unit=ml. Base Reference = 100ml.
                    // But allow simple 1-1 mapping for now.
    baseMeasureUnit: unit,
    isValid: true,
  };
};

export interface SkippedProduct {
  name: string;
  barcode: string;
  reason?: string;
}

// Flexible Header Mappings
const HEADER_MAPPINGS = {
  barcode: ['código de barras', 'codigo de barras', 'codigo de barra', 'código de barra', 'barcode', 'ean', 'sku', 'barra'],
  title: ['nombre', 'name', 'title', 'producto', 'product name', 'nombre del producto'],
  vendor: ['marca', 'brand', 'vendor', 'fabricante'],
  price: ['precio (eur)', 'precio', 'price', 'pvp', 'eur', 'costle'],
  size: ['tamaño', 'tamano', 'size', 'medida', 'capacidad', 'formato'],
  costPerItem: ['cost per item', 'costo', 'precio de costo', 'coste', 'cost', 'precio costo', 'costo por unidad']
};

const findHeader = (fileHeaders: string[], candidates: string[]): string | undefined => {
  const normalizedHeaders = fileHeaders.map(h => h.toLowerCase().trim());
  for (const candidate of candidates) {
    const idx = normalizedHeaders.indexOf(candidate.toLowerCase());
    if (idx !== -1) return fileHeaders[idx];
  }
  return undefined;
};

export const processNewProducts = (
  file: File,
  masterData: MasterData | null
): Promise<{ products: ProcessedProduct[]; skipped: SkippedProduct[]; headers: string[] }> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: any) => {
        const fileHeaders = results.meta.fields || [];
        
        // Resolve Headers
        const headerMap = {
            barcode: findHeader(fileHeaders, HEADER_MAPPINGS.barcode),
            title: findHeader(fileHeaders, HEADER_MAPPINGS.title),
            vendor: findHeader(fileHeaders, HEADER_MAPPINGS.vendor),
            price: findHeader(fileHeaders, HEADER_MAPPINGS.price),
            size: findHeader(fileHeaders, HEADER_MAPPINGS.size),
            costPerItem: findHeader(fileHeaders, HEADER_MAPPINGS.costPerItem),
        };

        const rawProducts = results.data;
        
        const processed: ProcessedProduct[] = [];
        const skipped: SkippedProduct[] = [];
        const seenBarcodesInFile = new Set<string>(); // Para evitar duplicados en el mismo archivo
        const seenTitlesInFile = new Set<string>();

        // Debug log to help diagnosis if it still fails
        console.log("Resolved Headers:", headerMap);

        rawProducts.forEach((raw: any, index: number) => {
          // Use mapped headers
          const barcodeField = headerMap.barcode;
          const barcode = sanitizeBarcode(barcodeField ? (raw[barcodeField] || "") : "");
          
          const titleField = headerMap.title;
          const name = titleField ? raw[titleField] : "";

          // Skip if no barcode (critical)
          if (!barcode) return;

          // 1. Check Barcode Duplicates (Primary - Exact Match)
          const masterBarcodes = masterData?.existingBarcodes ?? new Set<string>();
          if (masterBarcodes.has(barcode) || seenBarcodesInFile.has(barcode)) {
            // Solo lo añadimos a skipped si no lo hemos "visto" ya (para no duplicar el reporte)
            if (!seenBarcodesInFile.has(barcode)) {
               skipped.push({
                 name: name || "Desconocido",
                 barcode: barcode,
                 reason: "Código de Barras Duplicado"
               });
            }
            return;
          }

          // 2. Check Title Duplicates (Secondary - Reinforcement)
          const masterTitles = masterData?.existingTitles ?? new Set<string>();
          const normalizedTitle = name ? name.trim().toLowerCase() : "";
          if (normalizedTitle && (masterTitles.has(normalizedTitle) || seenTitlesInFile.has(normalizedTitle))) {
             if (!seenTitlesInFile.has(normalizedTitle)) {
                skipped.push({
                  name: name,
                  barcode: barcode,
                  reason: "Nombre Exacto Duplicado"
                });
             }
             return;
          }

          if (normalizedTitle) seenTitlesInFile.add(normalizedTitle);
          seenBarcodesInFile.add(barcode);

          const sizeField = headerMap.size;
          const size = sizeField ? raw[sizeField] : "";
          const unitPriceCalc = calculateUnitPrice(size || "");

          processed.push({
            id: barcode || `generated-${index}`,
            title: name,
            vendor: headerMap.vendor ? raw[headerMap.vendor] : "",
            price: headerMap.price ? raw[headerMap.price] : "",
            barcode: barcode,
            size: size,
            costPerItem: headerMap.costPerItem ? raw[headerMap.costPerItem] : "",
            
            generatedTitle: name,
            bodyHtml: "", 
            tags: "",
            images: [],
            seoTitle: "",
            seoDescription: "",
            
            metafields: {
              acorde: "",
              genero: "",
              notas_salida: "",
              ocasion: "",
              estacion: "",
              aroma: "",
              sexo_objetivo: "",
            },

            unitPrice: unitPriceCalc,
            isDuplicate: false, // We filtered them out
            isChecked: true,
            status: "pending",
            shopifySku: barcode,
            shopifyBarcode: barcode,
            shopifyInventoryQuantity: 10,
            shopifyWeightGrams: 0,
            shopifyRequiresShipping: true,
            shopifyTaxable: true,
            shopifyStatus: "ACTIVE",
            shopifyProductType: "Eau de Parfum",
            shopifyUnitPriceReferenceValue: 1,
          });
        });
        
        resolve({ products: processed, skipped, headers: fileHeaders });
      },
      error: (error: any) => reject(error),
    });
  });
};

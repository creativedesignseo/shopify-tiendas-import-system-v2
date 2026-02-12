import Papa from "papaparse";

export interface MasterData {
  headers: string[];
  existingBarcodes: Set<string>;
  totalProductsCount: number;
  htmlTemplate: string;
}

export const parseMasterCSV = (file: File): Promise<MasterData> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: any) => {
        if (results.meta.fields && results.meta.fields.length > 0) {
          const headers = results.meta.fields;
          const existingBarcodes = new Set<string>();
          const uniqueHandles = new Set<string>();
          let htmlTemplate = "";

          results.data.forEach((row: any) => {
            // Extract Barcode (Variant Barcode) for collision detection
            if (row["Variant Barcode"]) {
              existingBarcodes.add(row["Variant Barcode"].trim());
            }

            // Extract Handle for total product count (Shopify logic: one handle = one product)
            if (row["Handle"]) {
              uniqueHandles.add(row["Handle"].trim());
            }

            // Extract HTML Template from the first row that has it
            if (!htmlTemplate && row["Body (HTML)"]) {
              htmlTemplate = row["Body (HTML)"];
            }
          });

          // Fallback template if none found in master
          if (!htmlTemplate) {
            htmlTemplate = `
<div class="perfume-description">
  <p class="description-lead"><strong>{{name}}</strong> de <strong>{{brand}}</strong> es una fragancia sofisticada diseñada para quienes buscan distinción y elegancia.</p>
  <div class="notes-container">
    <h3>Notas Olfativas</h3>
    <ul>
      <li><strong>Acorde Principal:</strong> {{acorde}}</li>
      <li><strong>Género:</strong> {{genero}}</li>
    </ul>
  </div>
  <div class="usage-details">
    <p>Ideal para {{ocasion}} durante {{estacion}}.</p>
  </div>
</div>`.trim();
          }

          resolve({
            headers,
            existingBarcodes,
            totalProductsCount: uniqueHandles.size,
            htmlTemplate,
          });
        } else {
          reject(new Error("No se encontraron cabeceras en el archivo CSV."));
        }
      },
      error: (error: any) => {
        reject(error);
      },
    });
  });
};

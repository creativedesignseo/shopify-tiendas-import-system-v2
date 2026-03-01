import Papa from "papaparse"

export interface WholesaleProduct {
  handle: string
  title: string
  imageUrl: string
  originalPrice: number
  wholesalePrice: number
  category: string
  sku: string
}

export interface CatalogData {
  categories: Record<string, WholesaleProduct[]>
  totalProducts: number
}

// Function to normalize category from tags
function extractCategory(tags: string): string {
  const normalizedTags = tags.toLowerCase()
  if (normalizedTags.includes("rings") || normalizedTags.includes("anillos")) return "Anillos (Rings)"
  if (normalizedTags.includes("necklaces") || normalizedTags.includes("collares")) return "Collares (Necklaces)"
  if (normalizedTags.includes("bracelets") || normalizedTags.includes("pulseras")) return "Pulseras (Bracelets)"
  if (normalizedTags.includes("earrings") || normalizedTags.includes("pendientes")) return "Pendientes (Earrings)"
  if (normalizedTags.includes("anklets") || normalizedTags.includes("tobilleras")) return "Tobilleras (Anklets)"
  
  // Custom Category logic "Category: Example"
  const match = tags.match(/category:\s*([^,]+)/i)
  if (match && match[1]) {
    return match[1].trim()
  }

  return "Otros (Other)"
}

export function parseWholesaleCSV(file: File, onProgress: (pct: number) => void, abortSignal?: AbortSignal): Promise<CatalogData> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: any) => {
        try {
          onProgress(30)
          
          const productsMap = new Map<string, WholesaleProduct>()
          
          // Fallback mapping for column names based on exact Shopify export or Spanish export
          const getVal = (row: any, keys: string[]) => {
            for (const key of keys) {
              if (row[key] !== undefined && row[key] !== null) return row[key]
            }
            return ""
          }

          results.data.forEach((row: any) => {
            if (abortSignal?.aborted) throw new Error("Lectura del archivo cancelada por el usuario.")
            const handle = getVal(row, ["Handle"])
            if (!handle) return

            // If we already have this product, we only care if it brings a better image
            if (productsMap.has(handle)) {
               const existing = productsMap.get(handle)!
               const imgSrc = getVal(row, ["Image Src"])
               if (imgSrc && !existing.imageUrl) {
                  existing.imageUrl = imgSrc
               }
               return
            }

            // New product
            const title = getVal(row, ["Title", "Nombre"])
            const imgSrc = getVal(row, ["Image Src", "Imagen"])
            const tags = getVal(row, ["Tags", "Etiquetas"])
            const priceStr = getVal(row, ["Variant Price", "Precio de la variante"])
            const sku = getVal(row, ["Variant SKU", "SKU de la variante"])
            
            // Only add if it has a title
            if (!title) return

            const originalPrice = parseFloat(priceStr) || 0
            // Wholesale price is 35% of original (65% margin/discount conceptually based on user request "price0.35")
            const wholesalePrice = originalPrice * 0.35

            const category = extractCategory(tags)

            productsMap.set(handle, {
              handle,
              title,
              imageUrl: imgSrc,
              originalPrice,
              wholesalePrice: Number(wholesalePrice.toFixed(2)),
              category,
              sku
            })
          })

          onProgress(50)

          // Group by category
          const categories: Record<string, WholesaleProduct[]> = {}
          let totalProducts = 0
          
          const sortedProducts = Array.from(productsMap.values()).sort((a, b) => a.title.localeCompare(b.title))

          sortedProducts.forEach(prod => {
            if (!categories[prod.category]) {
              categories[prod.category] = []
            }
            categories[prod.category].push(prod)
            totalProducts++
          })

          // Sort categories alphabetically, but put "Otros (Other)" at the end
          const sortedCategories: Record<string, WholesaleProduct[]> = {}
          const catKeys = Object.keys(categories).sort((a, b) => {
             if (a === "Otros (Other)") return 1
             if (b === "Otros (Other)") return -1
             return a.localeCompare(b)
          })

          catKeys.forEach(k => {
             sortedCategories[k] = categories[k]
          })

          resolve({ categories: sortedCategories, totalProducts })

        } catch (error) {
          reject(error)
        }
      },
      error: (error: any) => reject(error)
    })
  })
}

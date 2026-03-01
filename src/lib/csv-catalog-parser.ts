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

export function parseWholesaleCSV(file: File, priceMultiplier: number, onProgress: (pct: number) => void, abortSignal?: AbortSignal): Promise<CatalogData> {
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
              if (row[key] !== undefined && row[key] !== null) {
                  return String(row[key]).trim()
              }
            }
            return ""
          }
          
          let currentHandle = ""
          let currentTitle = ""
          let currentCategory = ""
          let currentMainImage = ""

          results.data.forEach((row: any) => {
            if (abortSignal?.aborted) throw new Error("Lectura del archivo cancelada por el usuario.")
            const handle = getVal(row, ["Handle"])
            if (!handle) return

            // If this is the first row of a product, record its main details
            const rowTitle = getVal(row, ["Title", "Nombre"])
            if (rowTitle) {
              currentHandle = handle
              currentTitle = rowTitle
              const catRaw = getVal(row, ["Product Category", "Categoría de producto"])
              let cat = catRaw
              if (catRaw && catRaw.includes(">")) {
                  const parts = catRaw.split(">")
                  cat = parts[parts.length - 1].trim()
              }
              currentCategory = cat ? cat : "Otros (Other)"
              currentMainImage = getVal(row, ["Image Src", "Imagen"]) || ""
            }

            // Only process variant rows (they must have a variant price)
            const priceStr = getVal(row, ["Variant Price", "Precio de la variante"])
            if (!priceStr) return // Skips extra image rows that have no price

            const option1 = getVal(row, ["Option1 Value", "Valor de la opción 1"])
            const sku = getVal(row, ["Variant SKU", "SKU de la variante"])
            const rowImage = getVal(row, ["Image Src", "Imagen"])

            // Strict rule: if there's no image at all, do not add to catalog
            const finalImage = rowImage || currentMainImage
            if (!finalImage) return

            // Append Option1 Value to title if it's a real variant option (not "Default Title")
            let finalTitle = currentTitle
            if (option1 && option1.toLowerCase() !== "default title") {
              finalTitle = `${currentTitle} - ${option1}`
            }

            const originalPrice = parseFloat(priceStr) || 0
            const wholesalePrice = originalPrice * priceMultiplier

            // Use SKU as unique key, or fallback to Handle + Option1
            const uniqueKey = sku ? sku : `${handle}-${option1}`

            // Allow only one entry per variant (first one wins, avoiding duplicates)
            if (!productsMap.has(uniqueKey)) {
              productsMap.set(uniqueKey, {
                handle,
                title: finalTitle,
                imageUrl: finalImage,
                originalPrice,
                wholesalePrice: Number(wholesalePrice.toFixed(2)),
                category: currentCategory,
                sku
              })
            }
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

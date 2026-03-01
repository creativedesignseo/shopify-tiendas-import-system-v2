import jsPDF from "jspdf"
import "jspdf-autotable"
import { CatalogData, WholesaleProduct } from "./csv-catalog-parser"

import { piroLogoBase64 } from "./piro-logo"

// Options for the PDF
const PDF_OPTIONS = {
  PAGE_WIDTH: 210, // A4 Portrait width in mm
  PAGE_HEIGHT: 297, // A4 Portrait height in mm
  MARGIN: 15,
  IMG_SIZE: 17, // Smaller image for list
  ROW_GAP: 6,
  HEADER_HEIGHT: 35 // Adjusted to ensure divider line goes beneath all text
}

// Convert an image URL to Base64 (needed for jsPDF)
async function getBase64Image(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // If no URL or broken URL, return empty string to trigger placeholder
    if (!url) {
       resolve("")
       return
    }

    const img = new Image()
    img.crossOrigin = "Anonymous"
    img.onload = () => {
      const canvas = document.createElement("canvas")
      // Resize down to save memory/PDF size
      const maxDim = 400
      let w = img.width
      let h = img.height
      if (w > maxDim || h > maxDim) {
         if (w > h) {
            h = (h / w) * maxDim
            w = maxDim
         } else {
            w = (w / h) * maxDim
            h = maxDim
         }
      }

      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext("2d")
      if (!ctx) {
         resolve("")
         return
      }

      // Fill white background for transparent images (PNGs)
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)
      
      const dataURL = canvas.toDataURL("image/jpeg", 0.8)
      resolve(dataURL)
    }
    
    img.onerror = () => {
      console.warn("Could not load image:", url)
      resolve("") // Resolve empty to use placeholder
    }
    
    // Add a cache buster sometimes helps with aggressive CORS on some CDNs
    img.src = url + (url.includes("?") ? "&" : "?") + "not-from-cache-please"
  })
}

function drawPlaceholder(doc: jsPDF, x: number, y: number, size: number) {
   doc.setFillColor(240, 240, 240)
   doc.rect(x, y, size, size, "F")
   doc.setTextColor(150, 150, 150)
   doc.setFontSize(8)
   doc.text("Sin Foto", x + (size/2), y + (size/2), { align: "center", baseline: "middle" })
}

// Function to draw the Piro Brand Header on each page
function drawBrandHeader(doc: jsPDF) {
  const pageWidth = PDF_OPTIONS.PAGE_WIDTH
  const margin = PDF_OPTIONS.MARGIN

  // Logo (Top Left)
  if (piroLogoBase64) {
     doc.addImage(piroLogoBase64, "JPEG", margin, margin, 15, 15)
  }

  // Company Info (Top Right)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(80, 80, 80)
  
  const rightAlign = pageWidth - margin
  let textY = margin + 2
  
  doc.text("755 NW 72nd Ave suite 10A", rightAlign, textY, { align: "right" })
  textY += 5
  doc.text("Miami FL 33126", rightAlign, textY, { align: "right" })
  textY += 5
  doc.text("+1 (786) 872-4360", rightAlign, textY, { align: "right" })
  textY += 5
  doc.text("Info@pirojewelry.com", rightAlign, textY, { align: "right" })

  // Divider Line
  doc.setDrawColor(220, 220, 220)
  doc.setLineWidth(0.5)
  doc.line(margin, PDF_OPTIONS.HEADER_HEIGHT + 4, pageWidth - margin, PDF_OPTIONS.HEADER_HEIGHT + 4)
}

export async function generateWholesalePDF(
  catalogData: CatalogData, 
  onProgress: (pct: number, status: string) => void,
  abortSignal?: AbortSignal
): Promise<void> {
  
  onProgress(50, "Iniciando motor PDF...")
  
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  })

  const pageWidth = PDF_OPTIONS.PAGE_WIDTH
  const margin = PDF_OPTIONS.MARGIN

  // Draw first page header
  drawBrandHeader(doc)
  let currentY = PDF_OPTIONS.HEADER_HEIGHT + 15

  let processedItems = 0

  for (const [category, products] of Object.entries(catalogData.categories)) {
     if (products.length === 0) continue
     if (abortSignal?.aborted) throw new Error("Generación de PDF cancelada por el usuario.")

     // Check if we need a new page for the category header (need at least 30mm)
     if (currentY > PDF_OPTIONS.PAGE_HEIGHT - 30 - margin) {
         doc.addPage()
         drawBrandHeader(doc)
         currentY = PDF_OPTIONS.HEADER_HEIGHT + 15
     }

     // Draw Category Header
     doc.setFont("helvetica", "bold")
     doc.setFontSize(14)
     doc.setTextColor(0, 0, 0)
     
     // Background for category header
     doc.setFillColor(245, 245, 245)
     doc.rect(margin, currentY - 6, pageWidth - (margin * 2), 10, "F")
     
     doc.text(category.toUpperCase(), margin + 3, currentY + 1)
     currentY += 12

     for (const product of products) {
        if (abortSignal?.aborted) throw new Error("Generación de PDF cancelada por el usuario.")
        
        // Ensure space for an item row (IMG_SIZE + GAP)
        if (currentY > PDF_OPTIONS.PAGE_HEIGHT - PDF_OPTIONS.IMG_SIZE - margin) {
           doc.addPage()
           drawBrandHeader(doc)
           currentY = PDF_OPTIONS.HEADER_HEIGHT + 15
        }

        processedItems++
        
        // Update progress safely
        const imgProgress = Math.floor(50 + ((processedItems / catalogData.totalProducts) * 45))
        onProgress(imgProgress, `Agregando item ${processedItems} / ${catalogData.totalProducts}...`)

        // --- ROW LAYOUT ---
        const startX = margin
        const textStartX = startX + PDF_OPTIONS.IMG_SIZE + 5
        const maxTextWidth = pageWidth - textStartX - margin - 30 // Leave 30mm right for price
        
        // 1. Image (Left aligned)
        const base64Img = await getBase64Image(product.imageUrl)
        if (base64Img) {
           try {
               doc.addImage(base64Img, "JPEG", startX, currentY, PDF_OPTIONS.IMG_SIZE, PDF_OPTIONS.IMG_SIZE)
           } catch (e) {
               drawPlaceholder(doc, startX, currentY, PDF_OPTIONS.IMG_SIZE)
           }
        } else {
           drawPlaceholder(doc, startX, currentY, PDF_OPTIONS.IMG_SIZE)
        }

        // 2. Title and SKU (Middle area, vertically centered relative to image)
        doc.setFont("helvetica", "bold")
        doc.setFontSize(10)
        doc.setTextColor(30, 30, 30)
        
        const titleLines: string[] = doc.splitTextToSize(product.title, maxTextWidth)
        // Draw title slightly below the top of the image
        doc.text(titleLines[0], textStartX, currentY + 4.5) 
        
        if (titleLines.length > 1) {
           doc.setFont("helvetica", "normal")
           doc.setFontSize(9)
           doc.text(titleLines[1] + (titleLines.length > 2 ? "..." : ""), textStartX, currentY + 9.5)
        }

        // Draw SKU underneath title
        if (product.sku) {
           doc.setFont("helvetica", "normal")
           doc.setFontSize(9)
           doc.setTextColor(100, 100, 100)
           const skuY = currentY + (titleLines.length > 1 ? 14 : 9.5)
           doc.text(`SKU: ${product.sku}`, textStartX, skuY)
        }

        // 3. Price (Right aligned, vertically centered)
        doc.setFont("helvetica", "bold")
        doc.setFontSize(12)
        doc.setTextColor(0, 0, 0)
        const priceString = `$${product.wholesalePrice.toFixed(2)}`
        doc.text(priceString, pageWidth - margin, currentY + (PDF_OPTIONS.IMG_SIZE / 2) + 2, { align: "right" })

        // Optional: Light bottom border for the row
        doc.setDrawColor(240, 240, 240)
        doc.setLineWidth(0.2)
        doc.line(margin, currentY + PDF_OPTIONS.IMG_SIZE + (PDF_OPTIONS.ROW_GAP/2), pageWidth - margin, currentY + PDF_OPTIONS.IMG_SIZE + (PDF_OPTIONS.ROW_GAP/2))

        // Move Y cursor for next row
        currentY += PDF_OPTIONS.IMG_SIZE + PDF_OPTIONS.ROW_GAP
     }
     
     // Extra space after a category finishes
     currentY += 5
  }

  onProgress(98, "Añadiendo números de página...")

  // Add Page Numbers
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
     if (abortSignal?.aborted) throw new Error("Generación de PDF cancelada por el usuario.")
     doc.setPage(i)
     doc.setFontSize(8)
     doc.setTextColor(150, 150, 150)
     const footerText = `Página ${i} de ${totalPages} - Catálogo Mayorista`
     doc.text(footerText, pageWidth / 2, PDF_OPTIONS.PAGE_HEIGHT - 8, { align: "center" })
     
     // Add website link at bottom right
     doc.setTextColor(50, 50, 200)
     doc.text("www.pirojewelry.com", pageWidth - margin, PDF_OPTIONS.PAGE_HEIGHT - 8, { align: "right" })
  }

  onProgress(100, "¡Catálogo Listo!")

  // Save the PDF
  doc.save("wholesale-catalog.pdf")
}

import jsPDF from "jspdf"
import "jspdf-autotable"
import { CatalogData, WholesaleProduct } from "./csv-catalog-parser"

import { piroLogoBase64 } from "./piro-logo"

// Options for the PDF
export type PdfFormat = "desktop" | "mobile"

export const getPdfOptions = (format: PdfFormat) => {
  if (format === "mobile") {
    return {
      PAGE_WIDTH: 108, // Mobile Portrait width in mm (1080px equivalent ratio)
      PAGE_HEIGHT: 192, // Mobile Portrait height in mm (1920px equivalent ratio)
      MARGIN: 8, // Tighter margin for mobile
      IMG_SIZE: 18, // Slightly larger image relative to the new smaller width
      ROW_GAP: 8, // More breathing room between items for touch-friendly look
      HEADER_HEIGHT: 30, // Adjusted header height for mobile
      FONT_HEADER: 7,
      FONT_TITLE: 9,
      FONT_SUB: 8,
      FONT_SKU: 7,
      FONT_PRICE: 10,
      FONT_TOC_TITLE: 14,
      FONT_TOC_ITEM: 10,
      FONT_FOOTER: 7,
      PRICE_WIDTH: 15
    }
  }

  // Desktop (A4)
  return {
    PAGE_WIDTH: 210, // A4 Portrait width in mm
    PAGE_HEIGHT: 297, // A4 Portrait height in mm
    MARGIN: 15,
    IMG_SIZE: 17, // Smaller image for list
    ROW_GAP: 6,
    HEADER_HEIGHT: 35, // Adjusted to ensure divider line goes beneath all text
    FONT_HEADER: 9,
    FONT_TITLE: 10,
    FONT_SUB: 9,
    FONT_SKU: 9,
    FONT_PRICE: 12,
    FONT_TOC_TITLE: 18,
    FONT_TOC_ITEM: 12,
    FONT_FOOTER: 8,
    PRICE_WIDTH: 30
  }
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
function drawBrandHeader(doc: jsPDF, PDF_OPTIONS: ReturnType<typeof getPdfOptions>) {
  const pageWidth = PDF_OPTIONS.PAGE_WIDTH
  const margin = PDF_OPTIONS.MARGIN

  // Logo (Top Left)
  if (piroLogoBase64) {
     doc.addImage(piroLogoBase64, "JPEG", margin, margin, 15, 15)
  }

  // Company Info (Top Right)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(PDF_OPTIONS.FONT_HEADER) // Smaller font for mobile header
  doc.setTextColor(80, 80, 80)
  
  const rightAlign = pageWidth - margin
  let textY = margin + 3
  
  doc.text("755 NW 72nd Ave suite 10A", rightAlign, textY, { align: "right" })
  textY += 4
  doc.text("Miami FL 33126", rightAlign, textY, { align: "right" })
  textY += 4
  doc.text("+1 (786) 872-4360", rightAlign, textY, { align: "right" })
  textY += 4
  doc.text("Info@pirojewelry.com", rightAlign, textY, { align: "right" })

  // Divider Line
  doc.setDrawColor(220, 220, 220)
  doc.setLineWidth(0.5)
  doc.line(margin, PDF_OPTIONS.HEADER_HEIGHT + 4, pageWidth - margin, PDF_OPTIONS.HEADER_HEIGHT + 4)
}

export async function generateWholesalePDF(
  catalogData: CatalogData, 
  format: PdfFormat,
  onProgress: (pct: number, status: string) => void,
  abortSignal?: AbortSignal
): Promise<void> {

  onProgress(50, "Iniciando motor PDF...")
  const PDF_OPTIONS = getPdfOptions(format)
  
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [PDF_OPTIONS.PAGE_WIDTH, PDF_OPTIONS.PAGE_HEIGHT]
  })

  const pageWidth = PDF_OPTIONS.PAGE_WIDTH
  const margin = PDF_OPTIONS.MARGIN

  // Structure to hold category index information
  const categoryTOC: { title: string, pageNumber: number, yPos: number }[] = []

  // PAGE 1: We will draw the Brand Header now, but reserve the body for the interactive index.
  drawBrandHeader(doc, PDF_OPTIONS)
  doc.addPage() // Immediately start products on Page 2
  
  drawBrandHeader(doc, PDF_OPTIONS)
  let currentY = PDF_OPTIONS.HEADER_HEIGHT + 15
  let processedItems = 0

  for (const [category, products] of Object.entries(catalogData.categories)) {
     if (products.length === 0) continue
     if (abortSignal?.aborted) throw new Error("Generación de PDF cancelada por el usuario.")

     // Check if we need a new page for the category header (need at least 30mm)
     if (currentY > PDF_OPTIONS.PAGE_HEIGHT - 30 - margin) {
         doc.addPage()
         drawBrandHeader(doc, PDF_OPTIONS)
         currentY = PDF_OPTIONS.HEADER_HEIGHT + 15
     }

     // Record Category in the TOC
     categoryTOC.push({
        title: category.toUpperCase(),
        pageNumber: doc.getNumberOfPages(),
        yPos: currentY
     })

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
           drawBrandHeader(doc, PDF_OPTIONS)
           currentY = PDF_OPTIONS.HEADER_HEIGHT + 15
        }

        processedItems++
        
        // Update progress safely
        const imgProgress = Math.floor(50 + ((processedItems / catalogData.totalProducts) * 45))
        onProgress(imgProgress, `Agregando item ${processedItems} / ${catalogData.totalProducts}...`)

        // --- ROW LAYOUT ---
        const startX = margin
        const textStartX = startX + PDF_OPTIONS.IMG_SIZE + 4
        const maxTextWidth = pageWidth - textStartX - margin - PDF_OPTIONS.PRICE_WIDTH 
        
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
        doc.setFontSize(PDF_OPTIONS.FONT_TITLE)
        doc.setTextColor(30, 30, 30)
        
        const titleLines: string[] = doc.splitTextToSize(product.title, maxTextWidth)
        doc.text(titleLines[0], textStartX, currentY + 4) 
        
        if (titleLines.length > 1) {
           doc.setFont("helvetica", "normal")
           doc.setFontSize(PDF_OPTIONS.FONT_SUB)
           doc.text(titleLines[1] + (titleLines.length > 2 ? "..." : ""), textStartX, currentY + 8.5)
        }

        // Draw SKU underneath title
        if (product.sku) {
           doc.setFont("helvetica", "normal")
           doc.setFontSize(PDF_OPTIONS.FONT_SKU)
           doc.setTextColor(100, 100, 100)
           const skuY = currentY + (titleLines.length > 1 ? 12.5 : 8.5)
           doc.text(`SKU: ${product.sku}`, textStartX, skuY)
        }

        // 3. Price (Right aligned, vertically centered)
        doc.setFont("helvetica", "bold")
        doc.setFontSize(PDF_OPTIONS.FONT_PRICE)
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

  onProgress(97, "Generando Índice Interactivo...")

  // Go back to Page 1 to draw the interactive TOC (Table of Contents)
  doc.setPage(1)
  
  let tocY = PDF_OPTIONS.HEADER_HEIGHT + 20
  
  // Title for Index
  doc.setFont("helvetica", "bold")
  doc.setFontSize(PDF_OPTIONS.FONT_TOC_TITLE)
  doc.setTextColor(0, 0, 0)
  doc.text("ÍNDICE DE CONTENIDOS", pageWidth / 2, tocY, { align: "center" })
  
  tocY += 12
  doc.setFontSize(PDF_OPTIONS.FONT_TOC_ITEM)

  // Draw the actual table of contents
  for (const tocItem of categoryTOC) {
     if (abortSignal?.aborted) throw new Error("Generación de PDF cancelada por el usuario.")
     doc.setFont("helvetica", "bold")
     doc.setTextColor(30, 30, 150) // Dark Blue to hint it's clickable

     const titleStr = tocItem.title
     const pageStr = `Pág. ${tocItem.pageNumber}`
     
     if (format === "mobile") {
        // MOBILE: Draw Category on the left, Page Number on the right, sutil divider
        doc.text(titleStr, margin, tocY)
        doc.setFont("helvetica", "normal")
        doc.setFontSize(PDF_OPTIONS.FONT_TOC_ITEM - 1)
        doc.text(pageStr, pageWidth - margin, tocY, { align: "right" })
        
        // Add a sutil dot-line manually under or besides for visual structure
        doc.setDrawColor(220, 220, 240)
        doc.setLineWidth(0.1)
        const textWidth = doc.getTextWidth(titleStr)
        const pageTextWidth = doc.getTextWidth(pageStr)
        doc.line(margin + textWidth + 2, tocY - 1, pageWidth - margin - pageTextWidth - 2, tocY - 1)
        
        // Reset for next
        doc.setFontSize(PDF_OPTIONS.FONT_TOC_ITEM)
     } else {
        // DESKTOP: Traditional Dots calculation
        const titleWidth = doc.getTextWidth(titleStr)
        const dotWidth = doc.getTextWidth(".")
        const pageStrWidth = doc.getTextWidth(pageStr)
        
        const dotSpace = (pageWidth - (margin * 2) - titleWidth - pageStrWidth) - 4
        const numDots = Math.floor(dotSpace / dotWidth)
        
        let dots = ""
        for (let i=0; i < numDots; i++) dots += "."
        const fullLine = `${titleStr} ${dots} ${pageStr}`
        doc.text(fullLine, margin, tocY)
     }
     
     // Make the entire area interactive
     doc.link(margin, tocY - 5, pageWidth - (margin * 2), 7, { pageNumber: tocItem.pageNumber })
     
     tocY += 10
  }

  onProgress(98, "Añadiendo números de página...")

  // Add Page Numbers (Adjust total pages correctly since we skip first page footer)
  const totalPages = doc.getNumberOfPages()
  for (let i = 2; i <= totalPages; i++) { // Start footer from page 2
     if (abortSignal?.aborted) throw new Error("Generación de PDF cancelada por el usuario.")
     doc.setPage(i)
     doc.setFontSize(PDF_OPTIONS.FONT_FOOTER)
     doc.setFont("helvetica", "normal")
     doc.setTextColor(150, 150, 150)
     const footerText = `Página ${i} de ${totalPages}`
     doc.text(footerText, margin, PDF_OPTIONS.PAGE_HEIGHT - 6)
     
     // Add website link at bottom right
     doc.setTextColor(50, 50, 200)
     doc.textWithLink("www.pirojewelry.com", pageWidth - margin, PDF_OPTIONS.PAGE_HEIGHT - 6, { url: "https://www.pirojewelry.com", align: "right" })
  }

  onProgress(100, "¡Catálogo Listo!")

  // Generate dynamic filename
  const now = new Date()
  const day = String(now.getDate()).padStart(2, "0")
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const year = now.getFullYear()
  const dateStr = `${day}-${month}-${year}`
  
  // 5 random characters
  const uniqueId = Math.random().toString(36).substring(2, 7).toUpperCase()
  
  const filename = `wholesale-${format}-${dateStr}-${uniqueId}.pdf`

  // Save the PDF
  doc.save(filename)
}

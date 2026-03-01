import jsPDF from "jspdf"
import "jspdf-autotable"
import { CatalogData, WholesaleProduct } from "./csv-catalog-parser"

import { piroLogoBase64 } from "./piro-logo"

// Options for the PDF
const PDF_OPTIONS = {
  PAGE_WIDTH: 108, // Mobile Portrait width in mm (1080px equivalent ratio)
  PAGE_HEIGHT: 192, // Mobile Portrait height in mm (1920px equivalent ratio)
  MARGIN: 8, // Tighter margin for mobile
  IMG_SIZE: 18, // Slightly larger image relative to the new smaller width
  ROW_GAP: 8, // More breathing room between items for touch-friendly look
  HEADER_HEIGHT: 30 // Adjusted header height for mobile
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
  doc.setFontSize(7) // Smaller font for mobile header
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
  onProgress: (pct: number, status: string) => void,
  abortSignal?: AbortSignal
): Promise<void> {

  onProgress(50, "Iniciando motor PDF...")
  
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
  drawBrandHeader(doc)
  doc.addPage() // Immediately start products on Page 2
  
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
           drawBrandHeader(doc)
           currentY = PDF_OPTIONS.HEADER_HEIGHT + 15
        }

        processedItems++
        
        // Update progress safely
        const imgProgress = Math.floor(50 + ((processedItems / catalogData.totalProducts) * 45))
        onProgress(imgProgress, `Agregando item ${processedItems} / ${catalogData.totalProducts}...`)

        // --- ROW LAYOUT ---
        const startX = margin
        const textStartX = startX + PDF_OPTIONS.IMG_SIZE + 4
        // Mobile requires smaller right-side price width (18mm) 
        const maxTextWidth = pageWidth - textStartX - margin - 15 
        
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
        doc.setFontSize(9) // Mobile friendly font
        doc.setTextColor(30, 30, 30)
        
        const titleLines: string[] = doc.splitTextToSize(product.title, maxTextWidth)
        doc.text(titleLines[0], textStartX, currentY + 4) 
        
        if (titleLines.length > 1) {
           doc.setFont("helvetica", "normal")
           doc.setFontSize(8)
           doc.text(titleLines[1] + (titleLines.length > 2 ? "..." : ""), textStartX, currentY + 8.5)
        }

        // Draw SKU underneath title
        if (product.sku) {
           doc.setFont("helvetica", "normal")
           doc.setFontSize(7)
           doc.setTextColor(100, 100, 100)
           const skuY = currentY + (titleLines.length > 1 ? 12.5 : 8.5)
           doc.text(`SKU: ${product.sku}`, textStartX, skuY)
        }

        // 3. Price (Right aligned, vertically centered)
        doc.setFont("helvetica", "bold")
        doc.setFontSize(10) // Emphasized price size for mobile
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
  doc.setFontSize(14)
  doc.setTextColor(0, 0, 0)
  doc.text("ÍNDICE DE CONTENIDOS", pageWidth / 2, tocY, { align: "center" })
  
  tocY += 12
  doc.setFontSize(10)

  // Draw the actual table of contents
  for (const tocItem of categoryTOC) {
     if (abortSignal?.aborted) throw new Error("Generación de PDF cancelada por el usuario.")
     doc.setFont("helvetica", "bold")
     doc.setTextColor(30, 30, 150) // Dark Blue to hint it's clickable

     const titleStr = tocItem.title
     const pageStr = `Pág. ${tocItem.pageNumber}`
     
     // Calculate dot placement
     const titleWidth = doc.getTextWidth(titleStr)
     const dotWidth = doc.getTextWidth(".")
     const pageStrWidth = doc.getTextWidth(pageStr)
     
     const dotSpace = (pageWidth - (margin * 2) - titleWidth - pageStrWidth)
     const numDots = Math.floor(dotSpace / dotWidth) - 2
     
     // Create a string of dots (....... )
     let dots = ""
     for (let i=0; i < numDots; i++) dots += "."

     const fullLine = `${titleStr} ${dots} ${pageStr}`
     
     // Draw the title (made interactive)
     doc.textWithLink(fullLine, margin, tocY, { pageNumber: tocItem.pageNumber })
     
     tocY += 10
     
     // If the index gets too long for the first page, we add another page after it
     // But usually there aren't that many product categories.
  }

  onProgress(98, "Añadiendo números de página...")

  // Add Page Numbers (Adjust total pages correctly since we skip first page footer)
  const totalPages = doc.getNumberOfPages()
  for (let i = 2; i <= totalPages; i++) { // Start footer from page 2
     if (abortSignal?.aborted) throw new Error("Generación de PDF cancelada por el usuario.")
     doc.setPage(i)
     doc.setFontSize(7)
     doc.setFont("helvetica", "normal")
     doc.setTextColor(150, 150, 150)
     const footerText = `Página ${i} de ${totalPages}`
     doc.text(footerText, margin, PDF_OPTIONS.PAGE_HEIGHT - 6)
     
     // Add website link at bottom right
     doc.setTextColor(50, 50, 200)
     doc.textWithLink("www.pirojewelry.com", pageWidth - margin, PDF_OPTIONS.PAGE_HEIGHT - 6, { url: "https://www.pirojewelry.com", align: "right" })
  }

  onProgress(100, "¡Catálogo Listo!")

  // Save the PDF
  doc.save("wholesale-catalog.pdf")
}

"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProcessedProduct } from "@/lib/product-processor"
import { MasterData } from "@/lib/csv-parser"
import { Loader2, Sparkles, Search, ExternalLink, Check, Image as ImageIcon, FileText, TriangleAlert, X, Plus } from "lucide-react"

interface ProductReviewDialogProps {
  product: ProcessedProduct
  masterData: MasterData | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: (id: string, fieldOrUpdates: string | Partial<ProcessedProduct>, value?: any) => void
}

export function ProductReviewDialog({ 
  product, 
  masterData, 
  open, 
  onOpenChange, 
  onUpdate 
}: ProductReviewDialogProps) {
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState("details")
  const [showQuotaError, setShowQuotaError] = React.useState(false)
  const [quotaErrorMessage, setQuotaErrorMessage] = React.useState("")
  const [errorMetadata, setErrorMetadata] = React.useState<{masked_key?: string, key_source?: string, provider?: string} | null>(null)

  const handleGenerate = async () => {
    if (!masterData) return
    setIsGenerating(true)

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: {
            Nombre: product.title,
            Marca: product.vendor,
            Tamaño: product.size
          },
          htmlTemplate: masterData.htmlTemplate,
          provider: localStorage.getItem("ai_provider") || "gemini",
          apiKey: localStorage.getItem("ai_api_key") || "",
          modelVersion: localStorage.getItem("ai_model_version") || "gemini-2.5-flash"
        })
      })

      const rawData = await res.json()
      if (!res.ok) {
         const error = new Error(rawData.error || "API Error")
         // Attach details to the error object for the catch block
         ;(error as any).details = rawData.details
         throw error
      }
      
      const aiData = rawData

      // Fallback logic matches main page
      let finalBodyHtml = aiData.body_html || ""
      if (!finalBodyHtml) {
          const template = masterData.htmlTemplate || ""
          finalBodyHtml = template
            .replace(/{{name}}/g, product.title)
            .replace(/{{brand}}/g, product.vendor)
            .replace(/{{acorde}}/g, aiData.metafields?.acorde || "N/A")
            .replace(/{{genero}}/g, aiData.metafields?.genero || "N/A")
            .replace(/{{ocasion}}/g, aiData.metafields?.ocasion || "N/A")
            .replace(/{{estacion}}/g, aiData.metafields?.estacion || "N/A")
            .replace(/{{aroma}}/g, aiData.metafields?.aroma || "N/A")
      }

      // Build update preserving manually-edited fields
      const hasExistingImages = product.images.some(img => img && img.trim() !== "")
      const aiImages = aiData.image_url ? [aiData.image_url] : []
      
      onUpdate(product.id, {
        status: "complete",
        generatedTitle: aiData.title || product.generatedTitle || product.title,
        bodyHtml: finalBodyHtml,
        seoTitle: aiData.seo_title || product.seoTitle || "",
        seoDescription: aiData.seo_description || product.seoDescription || "",
        tags: product.tags || aiData.tags || "",
        // Only set images from AI if user hasn't manually added any
        images: hasExistingImages ? product.images : (aiImages.length > 0 ? aiImages : product.images),
        metafields: {
           acorde: product.metafields.acorde || aiData.metafields?.acorde || "",
           genero: product.metafields.genero || aiData.metafields?.genero || "",
           notas_salida: product.metafields.notas_salida || aiData.metafields?.notas_salida || "",
           ocasion: product.metafields.ocasion || aiData.metafields?.ocasion || "",
           estacion: product.metafields.estacion || aiData.metafields?.estacion || "",
           aroma: product.metafields.aroma || aiData.metafields?.aroma || "",
           sexo_objetivo: product.metafields.sexo_objetivo || aiData.metafields?.sexo_objetivo || "",
        },
        modelUsed: aiData.model_used
      })
      
      // Auto-switch to preview tab if successful
      setActiveTab("preview")

    } catch (error: any) {
      console.error("Error generating single product:", error)
      const errorMsg = error.message || ""
      const isQuotaError = errorMsg.includes("429") || errorMsg.toLowerCase().includes("quota")
      
      if (error.details) {
         setErrorMetadata(error.details)
      } else {
         setErrorMetadata(null)
      }

      if (isQuotaError) {
         setQuotaErrorMessage(errorMsg)
         setShowQuotaError(true)
      } else {
         alert(`Error: ${errorMsg}`)
      }
      
      onUpdate(product.id, { 
         status: "error", 
         errorDetails: errorMsg 
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleImageSearch = () => {
    window.open(`https://www.google.com/search?q=${encodeURIComponent(product.vendor + " " + product.title + " perfume bottle")}&tbm=isch`, '_blank')
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[95vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 border-b">
           <div className="flex justify-between items-start">
              <div>
                <DialogTitle className="text-xl flex flex-wrap items-center gap-2">
                   {product.title}
                   {product.status === "complete" && (
                     <div className="flex items-center gap-2">
                       <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">
                         <Check className="w-3 h-3 mr-1"/> Listo
                       </Badge>
                       {product.modelUsed && (
                         <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                           {product.modelUsed
                              .replace("models/", "")
                              .replace("gemini-", "Gemini ")
                              .replace("-flash", " Flash")
                              .replace("-pro", " Pro")
                              .replace("-lite", " Lite")
                              .replace("gpt-", "GPT-")}
                         </Badge>
                       )}
                     </div>
                   )}
                </DialogTitle>
                <DialogDescription className="mt-1">
                   {product.vendor} • {product.size} • {product.barcode}
                </DialogDescription>
              </div>
              <Button 
                onClick={handleGenerate} 
                disabled={isGenerating || !masterData}
                className="bg-black hover:bg-black/80 text-white shadow-md rounded-full px-6"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generando...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" /> 
                    {product.status === "complete" ? "Regenerar con IA" : "Generar Contenido IA"}
                  </>
                )}
              </Button>
           </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
           {/* LEFT COLUMN: Data & Images */}
           <ScrollArea className="w-full md:w-[35%] border-b md:border-b-0 md:border-r bg-muted/10 p-6 h-[400px] md:h-auto">
              <div className="space-y-6">
                 
                 {/* Images Section */}
                 <div className="space-y-3">
                    <Label className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
                       <ImageIcon className="w-3 h-3" /> Imágenes ({product.images.filter(Boolean).length}/3)
                    </Label>
                    
                    {/* Image cards */}
                    <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                       {(product.images.length > 0 ? product.images : [""]).map((imgUrl, idx) => (
                         <div 
                           key={idx} 
                           className={`flex items-center gap-3 px-3 py-2.5 bg-white hover:bg-muted/30 transition-colors ${
                             idx > 0 ? "border-t border-[var(--border)]" : ""
                           }`}
                         >
                            {/* Thumbnail */}
                            <div className="shrink-0">
                              {imgUrl ? (
                                <img 
                                  src={imgUrl} 
                                  className="h-10 w-10 object-contain rounded-md border border-[var(--border)] bg-white"
                                  alt={`Img ${idx + 1}`}
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden') }}
                                />
                              ) : null}
                              <div className={`h-10 w-10 flex items-center justify-center rounded-md border border-dashed border-[var(--border)] bg-muted/30 text-muted-foreground ${imgUrl ? 'hidden' : ''}`}>
                                <ImageIcon className="w-4 h-4 opacity-30" />
                              </div>
                            </div>

                            {/* URL Input */}
                            <Input 
                               value={imgUrl || ""}
                               onChange={(e) => {
                                  const newImgs = [...product.images]
                                  newImgs[idx] = e.target.value
                                  onUpdate(product.id, "images", newImgs)
                               }}
                               placeholder={`URL Imagen ${idx + 1}`}
                               className="h-8 text-xs flex-1 border-[var(--border)] focus-visible:ring-1"
                            />

                            {/* Action buttons */}
                            <div className="flex shrink-0 gap-0.5">
                              {imgUrl ? (
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => window.open(imgUrl, '_blank')} title="Abrir imagen">
                                   <ExternalLink className="w-3 h-3" />
                                </Button>
                              ) : (
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-600 hover:text-blue-700" onClick={handleImageSearch} title="Buscar en Google">
                                   <Search className="w-3 h-3" />
                                </Button>
                              )}
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-7 w-7 text-muted-foreground hover:text-red-600" 
                                onClick={() => {
                                  const newImgs = product.images.filter((_, i) => i !== idx)
                                  onUpdate(product.id, "images", newImgs.length > 0 ? newImgs : [""])
                                }}
                                title="Eliminar imagen"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                         </div>
                       ))}
                    </div>

                    {/* Add image + Search buttons */}
                    <div className="flex gap-2">
                      {product.images.filter(Boolean).length < 3 && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1 text-xs rounded-lg"
                          onClick={() => {
                            const newImgs = [...product.images]
                            if (newImgs.length < 3) {
                              newImgs.push("")
                              onUpdate(product.id, "images", newImgs)
                            }
                          }}
                        >
                          <Plus className="w-3 h-3 mr-1.5" /> Añadir Imagen
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="flex-1 text-xs rounded-lg" onClick={handleImageSearch}>
                         <Search className="w-3 h-3 mr-1.5" /> Buscar en Google
                      </Button>
                    </div>
                 </div>

                 <div className="h-px bg-border" />

                 {/* Basic Info */}
                 <div className="space-y-3">
                    <Label className="text-xs font-semibold uppercase text-muted-foreground">Información Básica</Label>
                    <div className="grid gap-2">
                       <div className="space-y-1">
                          <Label className="text-xs">Título Final</Label>
                          <Input 
                             value={product.generatedTitle} 
                             onChange={(e) => onUpdate(product.id, "generatedTitle", e.target.value)}
                             className="h-8 font-medium"
                          />
                       </div>
                       <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                             <Label className="text-xs">Precio</Label>
                             <Input 
                                value={product.price}
                                onChange={(e) => onUpdate(product.id, "price", e.target.value)}
                                className="h-8"
                             />
                          </div>
                          <div className="space-y-1">
                             <Label className="text-xs">Tags</Label>
                             <Input 
                                value={product.tags}
                                onChange={(e) => onUpdate(product.id, "tags", e.target.value)}
                                className="h-8"
                             />
                          </div>
                       </div>
                    </div>
                 </div>

              </div>
           </ScrollArea>

           {/* RIGHT COLUMN: Preview & Metafields */}
           <div className="flex-1 flex flex-col bg-white">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                 <div className="border-b px-6 pt-2">
                    <TabsList className="bg-transparent h-10 p-0">
                       <TabsTrigger value="details" className="h-9 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none bg-transparent">
                          Metafields
                       </TabsTrigger>
                       <TabsTrigger value="preview" className="h-9 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none bg-transparent">
                          Vista Previa HTML
                       </TabsTrigger>
                       <TabsTrigger value="code" className="h-9 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none bg-transparent">
                          Código HTML
                       </TabsTrigger>
                       <TabsTrigger value="seo" className="h-9 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none bg-transparent">
                          SEO
                       </TabsTrigger>
                    </TabsList>
                 </div>

                 <div className="flex-1 overflow-auto bg-slate-50/50">
                    <TabsContent value="details" className="p-6 m-0 h-full">
                       <div className="grid grid-cols-2 gap-4">
                          {Object.entries(product.metafields).map(([key, val]) => (
                             <div key={key} className="space-y-1">
                                <Label className="capitalize text-xs text-muted-foreground">{key.replace(/_/g, " ")}</Label>
                                <Input 
                                   value={val as string}
                                   onChange={(e) => {
                                      const newMeta = {...product.metafields, [key]: e.target.value}
                                      onUpdate(product.id, "metafields", newMeta)
                                   }}
                                   className="bg-white"
                                />
                             </div>
                          ))}
                       </div>
                    </TabsContent>

                     <TabsContent value="preview" className="p-0 m-0 h-full overflow-y-auto" style={{ maxHeight: '72vh' }}>
                        {/* Shopify Admin Polaris-style editable preview */}
                        <div style={{
                          background: '#f1f1f1',
                          minHeight: '100%',
                          padding: '1.25rem',
                          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'San Francisco', 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
                          fontSize: '0.8125rem',
                          lineHeight: '1.25rem',
                          color: '#303030',
                          fontWeight: 450,
                          WebkitFontSmoothing: 'antialiased',
                        }}>
                           {product.bodyHtml ? (
                             <div style={{ display: 'flex', gap: '1.25rem', maxWidth: '62rem', margin: '0 auto', alignItems: 'flex-start' }}>
                               {/* ======= LEFT MAIN COLUMN ======= */}
                               <div style={{ flex: '1 1 0%', minWidth: 0 }}>
                                 {/* Title Card */}
                                 <div style={{
                                   background: '#fff',
                                   borderRadius: '0.75rem',
                                   padding: '1.25rem',
                                   marginBottom: '1rem',
                                   boxShadow: '0 0.0625rem 0.1875rem rgba(0,0,0,.04), 0 0 0 0.0625rem rgba(0,0,0,.06)',
                                 }}>
                                   <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#303030', marginBottom: '0.25rem' }}>Título</label>
                                   <div
                                     contentEditable
                                     suppressContentEditableWarning
                                     onBlur={(e) => onUpdate(product.id, "generatedTitle", e.currentTarget.textContent || "")}
                                     style={{
                                       border: '0.0625rem solid #8a8a8a',
                                       borderRadius: '0.5rem',
                                       padding: '0.375rem 0.75rem',
                                       fontSize: '0.8125rem',
                                       lineHeight: '1.25rem',
                                       color: '#303030',
                                       background: '#fff',
                                       minHeight: '2rem',
                                       outline: 'none',
                                       cursor: 'text',
                                     }}
                                     dangerouslySetInnerHTML={{ __html: product.generatedTitle || product.title }}
                                   />
                                 </div>

                                 {/* Description Card */}
                                 <div style={{
                                   background: '#fff',
                                   borderRadius: '0.75rem',
                                   padding: '1.25rem',
                                   marginBottom: '1rem',
                                   boxShadow: '0 0.0625rem 0.1875rem rgba(0,0,0,.04), 0 0 0 0.0625rem rgba(0,0,0,.06)',
                                 }}>
                                   <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#303030', marginBottom: '0.5rem' }}>Descripción</label>
                                   {/* ── Full Polaris Toolbar ── */}
                                   <div style={{
                                     display: 'flex',
                                     alignItems: 'center',
                                     flexWrap: 'wrap',
                                     gap: '0.0625rem',
                                     padding: '0.25rem 0.375rem',
                                     background: '#f7f7f7',
                                     borderTopLeftRadius: '0.5rem',
                                     borderTopRightRadius: '0.5rem',
                                     border: '0.0625rem solid #8a8a8a',
                                     borderBottom: '0.0625rem solid #e3e3e3',
                                   }}>
                                     {/* Paragraph dropdown */}
                                     <button type="button" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: '#303030', background: 'transparent', border: 'none', borderRadius: '0.375rem', cursor: 'default', fontFamily: 'inherit', fontWeight: 450, height: '1.75rem' }}>
                                       Párrafo
                                       <svg width="10" height="10" viewBox="0 0 20 20" fill="none"><path d="M6 8l4 4 4-4" stroke="#616161" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                     </button>
                                     <div style={{ width: '0.0625rem', height: '1.25rem', background: '#d9d9d9', margin: '0 0.25rem' }} />
                                     {/* Bold */}
                                     <button type="button" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '1.75rem', height: '1.75rem', background: 'transparent', border: 'none', borderRadius: '0.375rem', cursor: 'default', padding: 0 }}>
                                       <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M6 4h5.5a3 3 0 010 6H6V4z" stroke="#4a4a4a" strokeWidth="1.8"/><path d="M6 10h6.5a3 3 0 010 6H6v-6z" stroke="#4a4a4a" strokeWidth="1.8"/></svg>
                                     </button>
                                     {/* Italic */}
                                     <button type="button" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '1.75rem', height: '1.75rem', background: 'transparent', border: 'none', borderRadius: '0.375rem', cursor: 'default', padding: 0 }}>
                                       <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><line x1="13" y1="4" x2="7" y2="16" stroke="#4a4a4a" strokeWidth="1.8"/><line x1="8" y1="4" x2="14" y2="4" stroke="#4a4a4a" strokeWidth="1.5"/><line x1="6" y1="16" x2="12" y2="16" stroke="#4a4a4a" strokeWidth="1.5"/></svg>
                                     </button>
                                     {/* Underline */}
                                     <button type="button" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '1.75rem', height: '1.75rem', background: 'transparent', border: 'none', borderRadius: '0.375rem', cursor: 'default', padding: 0 }}>
                                       <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M6 4v6a4 4 0 008 0V4" stroke="#4a4a4a" strokeWidth="1.8" strokeLinecap="round"/><line x1="5" y1="17" x2="15" y2="17" stroke="#4a4a4a" strokeWidth="1.5"/></svg>
                                     </button>
                                     {/* Strikethrough */}
                                     <button type="button" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '1.75rem', height: '1.75rem', background: 'transparent', border: 'none', borderRadius: '0.375rem', cursor: 'default', padding: 0 }}>
                                       <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><line x1="3" y1="10" x2="17" y2="10" stroke="#4a4a4a" strokeWidth="1.5"/><path d="M12.5 6.5C12.5 5.12 11.38 4 10 4S7.5 5.12 7.5 6.5" stroke="#4a4a4a" strokeWidth="1.5" fill="none"/><path d="M7.5 13.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5" stroke="#4a4a4a" strokeWidth="1.5" fill="none"/></svg>
                                     </button>
                                     <div style={{ width: '0.0625rem', height: '1.25rem', background: '#d9d9d9', margin: '0 0.25rem' }} />
                                     {/* Bulleted list */}
                                     <button type="button" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '1.75rem', height: '1.75rem', background: 'transparent', border: 'none', borderRadius: '0.375rem', cursor: 'default', padding: 0 }}>
                                       <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><circle cx="4" cy="5" r="1.5" fill="#4a4a4a"/><circle cx="4" cy="10" r="1.5" fill="#4a4a4a"/><circle cx="4" cy="15" r="1.5" fill="#4a4a4a"/><line x1="8" y1="5" x2="17" y2="5" stroke="#4a4a4a" strokeWidth="1.5"/><line x1="8" y1="10" x2="17" y2="10" stroke="#4a4a4a" strokeWidth="1.5"/><line x1="8" y1="15" x2="17" y2="15" stroke="#4a4a4a" strokeWidth="1.5"/></svg>
                                     </button>
                                     {/* Numbered list */}
                                     <button type="button" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '1.75rem', height: '1.75rem', background: 'transparent', border: 'none', borderRadius: '0.375rem', cursor: 'default', padding: 0 }}>
                                       <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><text x="2" y="7" fontSize="5" fill="#4a4a4a" fontFamily="Inter, sans-serif" fontWeight="600">1</text><text x="2" y="12" fontSize="5" fill="#4a4a4a" fontFamily="Inter, sans-serif" fontWeight="600">2</text><text x="2" y="17" fontSize="5" fill="#4a4a4a" fontFamily="Inter, sans-serif" fontWeight="600">3</text><line x1="8" y1="5" x2="17" y2="5" stroke="#4a4a4a" strokeWidth="1.5"/><line x1="8" y1="10" x2="17" y2="10" stroke="#4a4a4a" strokeWidth="1.5"/><line x1="8" y1="15" x2="17" y2="15" stroke="#4a4a4a" strokeWidth="1.5"/></svg>
                                     </button>
                                     {/* Outdent */}
                                     <button type="button" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '1.75rem', height: '1.75rem', background: 'transparent', border: 'none', borderRadius: '0.375rem', cursor: 'default', padding: 0 }}>
                                       <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><line x1="8" y1="5" x2="17" y2="5" stroke="#4a4a4a" strokeWidth="1.5"/><line x1="8" y1="10" x2="17" y2="10" stroke="#4a4a4a" strokeWidth="1.5"/><line x1="3" y1="15" x2="17" y2="15" stroke="#4a4a4a" strokeWidth="1.5"/><path d="M5 7l-3 3 3 3" stroke="#4a4a4a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
                                     </button>
                                     {/* Indent */}
                                     <button type="button" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '1.75rem', height: '1.75rem', background: 'transparent', border: 'none', borderRadius: '0.375rem', cursor: 'default', padding: 0 }}>
                                       <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><line x1="8" y1="5" x2="17" y2="5" stroke="#4a4a4a" strokeWidth="1.5"/><line x1="8" y1="10" x2="17" y2="10" stroke="#4a4a4a" strokeWidth="1.5"/><line x1="3" y1="15" x2="17" y2="15" stroke="#4a4a4a" strokeWidth="1.5"/><path d="M3 7l3 3-3 3" stroke="#4a4a4a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
                                     </button>
                                     <div style={{ width: '0.0625rem', height: '1.25rem', background: '#d9d9d9', margin: '0 0.25rem' }} />
                                     {/* Link */}
                                     <button type="button" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '1.75rem', height: '1.75rem', background: 'transparent', border: 'none', borderRadius: '0.375rem', cursor: 'default', padding: 0 }}>
                                       <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M8.5 11.5l3-3" stroke="#4a4a4a" strokeWidth="1.5"/><path d="M9 13l-1.5 1.5a2.12 2.12 0 01-3-3L6 10" stroke="#4a4a4a" strokeWidth="1.5" strokeLinecap="round"/><path d="M11 7l1.5-1.5a2.12 2.12 0 013 3L14 10" stroke="#4a4a4a" strokeWidth="1.5" strokeLinecap="round"/></svg>
                                     </button>
                                     {/* Font color */}
                                     <button type="button" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '1.75rem', height: '1.75rem', background: 'transparent', border: 'none', borderRadius: '0.375rem', cursor: 'default', padding: 0 }}>
                                       <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M7 14l3-10 3 10" stroke="#4a4a4a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><line x1="8" y1="11" x2="12" y2="11" stroke="#4a4a4a" strokeWidth="1.5"/><rect x="5" y="16" width="10" height="2" rx="0.5" fill="#303030"/></svg>
                                     </button>
                                     {/* Alignment */}
                                     <button type="button" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '1.75rem', height: '1.75rem', background: 'transparent', border: 'none', borderRadius: '0.375rem', cursor: 'default', padding: 0 }}>
                                       <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><line x1="3" y1="4" x2="17" y2="4" stroke="#4a4a4a" strokeWidth="1.5"/><line x1="3" y1="8" x2="13" y2="8" stroke="#4a4a4a" strokeWidth="1.5"/><line x1="3" y1="12" x2="17" y2="12" stroke="#4a4a4a" strokeWidth="1.5"/><line x1="3" y1="16" x2="11" y2="16" stroke="#4a4a4a" strokeWidth="1.5"/></svg>
                                     </button>
                                     <div style={{ width: '0.0625rem', height: '1.25rem', background: '#d9d9d9', margin: '0 0.25rem' }} />
                                     {/* Table */}
                                     <button type="button" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '1.75rem', height: '1.75rem', background: 'transparent', border: 'none', borderRadius: '0.375rem', cursor: 'default', padding: 0 }}>
                                       <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><rect x="3" y="3" width="14" height="14" rx="1.5" stroke="#4a4a4a" strokeWidth="1.5" fill="none"/><line x1="3" y1="8" x2="17" y2="8" stroke="#4a4a4a" strokeWidth="1.2"/><line x1="3" y1="13" x2="17" y2="13" stroke="#4a4a4a" strokeWidth="1.2"/><line x1="10" y1="3" x2="10" y2="17" stroke="#4a4a4a" strokeWidth="1.2"/></svg>
                                     </button>
                                     {/* Image */}
                                     <button type="button" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '1.75rem', height: '1.75rem', background: 'transparent', border: 'none', borderRadius: '0.375rem', cursor: 'default', padding: 0 }}>
                                       <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><rect x="3" y="4" width="14" height="12" rx="1.5" stroke="#4a4a4a" strokeWidth="1.5" fill="none"/><circle cx="7.5" cy="8" r="1.5" fill="#4a4a4a"/><path d="M3 14l4-4 3 3 2-2 5 5H4.5A1.5 1.5 0 013 14.5V14z" fill="#4a4a4a" opacity="0.3"/></svg>
                                     </button>
                                     {/* Video */}
                                     <button type="button" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '1.75rem', height: '1.75rem', background: 'transparent', border: 'none', borderRadius: '0.375rem', cursor: 'default', padding: 0 }}>
                                       <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><rect x="2" y="5" width="11" height="10" rx="1.5" stroke="#4a4a4a" strokeWidth="1.5" fill="none"/><path d="M13 8l5-2.5v9L13 12" stroke="#4a4a4a" strokeWidth="1.5" strokeLinejoin="round" fill="none"/></svg>
                                     </button>
                                   </div>
                                   {/* ── Editable Content Area ── */}
                                   <div
                                     contentEditable
                                     suppressContentEditableWarning
                                     onBlur={(e) => onUpdate(product.id, "bodyHtml", e.currentTarget.innerHTML)}
                                     style={{
                                       border: '0.0625rem solid #8a8a8a',
                                       borderTop: 'none',
                                       borderBottomLeftRadius: '0.5rem',
                                       borderBottomRightRadius: '0.5rem',
                                       padding: '0.75rem 1rem',
                                       background: '#fff',
                                       fontSize: '0.8125rem',
                                       lineHeight: '1.25rem',
                                       color: '#303030',
                                       minHeight: '14rem',
                                       outline: 'none',
                                       cursor: 'text',
                                       whiteSpace: 'pre-wrap',
                                       wordBreak: 'break-word',
                                       overflowWrap: 'break-word',
                                     }}
                                     dangerouslySetInnerHTML={{ __html: product.bodyHtml }}
                                   />
                                 </div>

                                 {/* ── Multimedia Card ── */}
                                 <div style={{
                                   background: '#fff',
                                   borderRadius: '0.75rem',
                                   padding: '1.25rem',
                                   marginBottom: '1rem',
                                   boxShadow: '0 0.0625rem 0.1875rem rgba(0,0,0,.04), 0 0 0 0.0625rem rgba(0,0,0,.06)',
                                 }}>
                                   <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#303030', marginBottom: '0.75rem' }}>Multimedia</label>
                                   {product.images.filter(Boolean).length > 0 ? (
                                     <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(5rem, 1fr))', gap: '0.5rem' }}>
                                       {product.images.filter(Boolean).map((img, i) => (
                                         <div key={i} style={{ position: 'relative', aspectRatio: '1', borderRadius: '0.5rem', border: '0.0625rem solid #e3e3e3', overflow: 'hidden', background: '#f6f6f7' }}>
                                           <img src={img} alt={`Producto ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                         </div>
                                       ))}
                                       <div style={{ aspectRatio: '1', borderRadius: '0.5rem', border: '0.125rem dashed #c9cccf', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'default', background: '#f6f6f7' }}>
                                         <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><line x1="10" y1="4" x2="10" y2="16" stroke="#8c9196" strokeWidth="2" strokeLinecap="round"/><line x1="4" y1="10" x2="16" y2="10" stroke="#8c9196" strokeWidth="2" strokeLinecap="round"/></svg>
                                       </div>
                                     </div>
                                   ) : (
                                     <div style={{ border: '0.125rem dashed #c9cccf', borderRadius: '0.5rem', padding: '2rem', textAlign: 'center', color: '#6d7175', background: '#f6f6f7' }}>
                                       <svg width="28" height="28" viewBox="0 0 20 20" fill="none" style={{ margin: '0 auto 0.5rem' }}><rect x="2" y="3" width="16" height="14" rx="2" stroke="#8c9196" strokeWidth="1.5" fill="none"/><circle cx="7" cy="8" r="2" fill="#8c9196"/><path d="M2 15l5-5 3 3 2-2 6 6H4a2 2 0 01-2-2v-0z" fill="#8c9196" opacity="0.2"/></svg>
                                       <div style={{ fontSize: '0.75rem' }}>Agrega imágenes, videos o modelos 3D</div>
                                     </div>
                                   )}
                                 </div>
                               </div>

                               {/* ======= RIGHT SIDEBAR ======= */}
                               <div style={{ width: '15rem', flexShrink: 0 }}>
                                 {/* Status */}
                                 <div style={{ background: '#fff', borderRadius: '0.75rem', padding: '1.25rem', marginBottom: '1rem', boxShadow: '0 0.0625rem 0.1875rem rgba(0,0,0,.04), 0 0 0 0.0625rem rgba(0,0,0,.06)' }}>
                                   <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#303030', marginBottom: '0.5rem' }}>Estado</label>
                                   <div style={{ border: '0.0625rem solid #8a8a8a', borderRadius: '0.5rem', padding: '0.375rem 0.75rem', fontSize: '0.8125rem', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                     <span>Activo</span>
                                     <svg width="10" height="10" viewBox="0 0 20 20" fill="none"><path d="M6 8l4 4 4-4" stroke="#616161" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                   </div>
                                 </div>

                                 {/* Product Organization */}
                                 <div style={{ background: '#fff', borderRadius: '0.75rem', padding: '1.25rem', boxShadow: '0 0.0625rem 0.1875rem rgba(0,0,0,.04), 0 0 0 0.0625rem rgba(0,0,0,.06)' }}>
                                   <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#303030', marginBottom: '1rem' }}>Organización del producto</label>
                                   {/* Tipo */}
                                   <div style={{ marginBottom: '0.875rem' }}>
                                     <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: '#616161', marginBottom: '0.25rem' }}>Tipo de producto</label>
                                     <div style={{ border: '0.0625rem solid #8a8a8a', borderRadius: '0.5rem', padding: '0.375rem 0.75rem', fontSize: '0.8125rem', color: '#303030', background: '#fff' }}>Perfumes</div>
                                   </div>
                                   {/* Proveedor */}
                                   <div style={{ marginBottom: '0.875rem' }}>
                                     <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: '#616161', marginBottom: '0.25rem' }}>Proveedor</label>
                                     <div style={{ border: '0.0625rem solid #8a8a8a', borderRadius: '0.5rem', padding: '0.375rem 0.75rem', fontSize: '0.8125rem', color: '#303030', background: '#fff' }}>{product.vendor || '—'}</div>
                                   </div>
                                   {/* Colecciones */}
                                   <div style={{ marginBottom: '0.875rem' }}>
                                     <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: '#616161', marginBottom: '0.25rem' }}>Colecciones</label>
                                     <div style={{ border: '0.0625rem solid #8a8a8a', borderRadius: '0.5rem', padding: '0.375rem 0.75rem', fontSize: '0.8125rem', color: '#8c9196', fontStyle: 'italic', background: '#fff' }}>Buscar colecciones</div>
                                   </div>
                                   {/* Etiquetas */}
                                   <div>
                                     <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: '#616161', marginBottom: '0.25rem' }}>Etiquetas</label>
                                     <div style={{ border: '0.0625rem solid #8a8a8a', borderRadius: '0.5rem', padding: '0.375rem 0.75rem', fontSize: '0.8125rem', color: '#303030', background: '#fff', display: 'flex', flexWrap: 'wrap', gap: '0.25rem', minHeight: '2rem', alignItems: 'center' }}>
                                       {product.tags ? product.tags.split(',').filter(Boolean).map((tag, i) => (
                                         <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: '#e4e5e7', borderRadius: '0.375rem', padding: '0.125rem 0.5rem', fontSize: '0.75rem', color: '#303030', fontWeight: 450 }}>
                                           {tag.trim()}
                                           <svg width="8" height="8" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="#616161" strokeWidth="1.5" strokeLinecap="round"/></svg>
                                         </span>
                                       )) : <span style={{ color: '#8c9196', fontStyle: 'italic' }}>Sin etiquetas</span>}
                                     </div>
                                   </div>
                                 </div>
                               </div>
                             </div>
                           ) : (
                              <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground opacity-50">
                                 <FileText className="w-12 h-12 mb-2" />
                                 <p>Genera contenido con IA para ver la previsualización</p>
                              </div>
                           )}
                        </div>
                     </TabsContent>

                    <TabsContent value="code" className="p-0 m-0 h-full flex flex-col">
                       <Textarea 
                          value={product.bodyHtml}
                          onChange={(e) => onUpdate(product.id, "bodyHtml", e.target.value)}
                          className="flex-1 font-mono text-xs rounded-none border-0 resize-none p-6 focus-visible:ring-0"
                          placeholder="HTML Code..."
                       />
                    </TabsContent>

                    <TabsContent value="seo" className="p-6 m-0 h-full">
                       <div className="max-w-2xl mx-auto space-y-6">
                          <div className="space-y-2 p-4 border rounded-lg bg-white shadow-sm">
                             <Label className="text-xs font-semibold text-blue-600 mb-2 block">Vista Previa en Google</Label>
                             <div className="text-xl text-[#1a0dab] hover:underline cursor-pointer truncate">
                                {product.seoTitle || product.generatedTitle}
                             </div>
                             <div className="text-sm text-[#006621]">
                                www.tu-tienda.com › productos › {product.title.toLowerCase().replace(/ /g, "-")}
                             </div>
                             <div className="text-sm text-[#545454] line-clamp-2">
                                {product.seoDescription || "Descripción no generada. Utiliza el botón de IA para crear una descripción optimizada para SEO."}
                             </div>
                          </div>
                          
                          <div className="space-y-4">
                             <div className="space-y-1">
                                <div className="flex justify-between">
                                   <Label>Título SEO</Label>
                                   <span className={`text-xs ${product.seoTitle.length > 60 ? 'text-red-500' : 'text-muted-foreground'}`}>
                                      {product.seoTitle.length} / 60
                                   </span>
                                </div>
                                <Input 
                                   value={product.seoTitle}
                                   onChange={(e) => onUpdate(product.id, "seoTitle", e.target.value)}
                                />
                             </div>
                             <div className="space-y-1">
                                <div className="flex justify-between">
                                   <Label>Descripción SEO</Label>
                                   <span className={`text-xs ${product.seoDescription.length > 160 ? 'text-red-500' : 'text-muted-foreground'}`}>
                                      {product.seoDescription.length} / 160
                                   </span>
                                </div>
                                <Textarea 
                                   value={product.seoDescription}
                                   onChange={(e) => onUpdate(product.id, "seoDescription", e.target.value)}
                                   rows={3}
                                />
                             </div>
                          </div>
                       </div>
                    </TabsContent>
                 </div>
              </Tabs>
           </div>
        </div>

        <DialogFooter className="p-4 border-t/60 bg-muted/20">
           <div className="flex justify-between w-full items-center">
              <div className="text-xs text-muted-foreground">
                 {product.id}
              </div>
               <Button onClick={() => onOpenChange(false)} className="bg-black text-white hover:bg-black/90 rounded-full px-8 shadow-lg">
                  Cerrar / Guardar Cambios
               </Button>
           </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Quota Error Dialog */}
    <Dialog open={showQuotaError} onOpenChange={setShowQuotaError}>
      <DialogContent className="sm:max-w-[425px] border-red-200">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <TriangleAlert className="h-5 w-5" />
            Límite de Cuota Excedido (429)
          </DialogTitle>
          <DialogDescription className="pt-2">
            El modelo de IA ha alcanzado su límite de uso gratuito.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 text-sm text-muted-foreground">
          {errorMetadata && (
             <div className="mb-4 bg-orange-50 border border-orange-200 rounded p-3 text-orange-800 text-xs">
                <div className="flex justify-between items-center mb-1">
                   <strong>Token Utilizado:</strong> 
                   <code className="bg-white px-1 py-0.5 rounded border border-orange-300 font-mono">
                      {errorMetadata.masked_key}
                   </code>
                </div>
                <div className="flex justify-between items-center">
                   <strong>Origen:</strong>
                   <span>{errorMetadata.key_source}</span>
                </div>
             </div>
          )}

          <div className="mb-2">
            <strong>Detalle del error:</strong> 
            <div className="bg-red-50 p-2 rounded mt-1 border border-red-100 max-h-[200px] overflow-y-auto">
               <code className="text-red-500 text-xs font-mono break-all whitespace-pre-wrap">{quotaErrorMessage}</code>
            </div>
          </div>
          <p>
            Esto suele ocurrir con <strong>Gemini 2.0 Flash</strong> en cuentas gratuitas bajo alta demanda.
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1 text-xs">
             <li>Intenta cambiar a <strong>Gemini 2.0 Flash Lite</strong> en Configuración.</li>
             <li>Espera unos minutos antes de intentar de nuevo.</li>
             <li>Usa tu propia API Key si tienes una cuenta de pago.</li>
          </ul>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setShowQuotaError(false)}>
            Cerrar
          </Button> 
          <Button 
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={() => setShowQuotaError(false)}
          >
            Entendido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}

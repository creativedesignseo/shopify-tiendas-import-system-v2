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
import { Loader2, Sparkles, Search, ExternalLink, Check, Image as ImageIcon, FileText, TriangleAlert } from "lucide-react"

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
          modelVersion: localStorage.getItem("ai_model_version") || "gemini-2.0-flash"
        })
      })

      const rawData = await res.json()
      if (!res.ok) throw new Error(rawData.error || rawData.details || "API Error")
      
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

      onUpdate(product.id, {
        status: "complete",
        generatedTitle: aiData.title || product.title,
        bodyHtml: finalBodyHtml,
        seoTitle: aiData.seo_title || "",
        seoDescription: aiData.seo_description || "",
        tags: aiData.tags || "",
        images: [aiData.image_url || product.images[0] || ""],
        metafields: {
           acorde: aiData.metafields?.acorde || "",
           genero: aiData.metafields?.genero || "",
           notas_salida: aiData.metafields?.notas_salida || "",
           ocasion: aiData.metafields?.ocasion || "",
           estacion: aiData.metafields?.estacion || "",
           aroma: aiData.metafields?.aroma || "",
           sexo_objetivo: aiData.metafields?.sexo_objetivo || "",
        },
        modelUsed: aiData.model_used
      })
      
      // Auto-switch to preview tab if successful
      setActiveTab("preview")

    } catch (error: any) {
      console.error("Error generating single product:", error)
      const errorMsg = error.message || ""
      const isQuotaError = errorMsg.includes("429") || errorMsg.toLowerCase().includes("quota")

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
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 border-b">
           <div className="flex justify-between items-start">
              <div>
                <DialogTitle className="text-xl flex items-center gap-2">
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
           <ScrollArea className="w-full md:w-1/3 border-b md:border-b-0 md:border-r bg-muted/10 p-6 h-[400px] md:h-auto">
              <div className="space-y-6">
                 
                 {/* Images Section */}
                 <div className="space-y-3">
                    <Label className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
                       <ImageIcon className="w-3 h-3" /> Imágenes
                    </Label>
                    
                    <div className="flex justify-center mb-4">
                       {product.images[0] ? (
                          <img 
                            src={product.images[0]} 
                            className="h-40 w-40 object-contain rounded-lg border bg-white shadow-sm"
                            alt={`Imagen principal de ${product.title}`}
                          />
                       ) : (
                          <div className="h-40 w-40 flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/50 text-muted-foreground gap-2">
                             <ImageIcon className="w-8 h-8 opacity-20" />
                             <span className="text-xs">Sin imagen</span>
                          </div>
                       )}
                    </div>

                    <div className="space-y-2">
                      {[0, 1].map((idx) => (
                        <div key={idx} className="flex gap-2">
                           <Input 
                              value={product.images[idx] || ""}
                              onChange={(e) => {
                                 const newImgs = [...product.images]
                                 newImgs[idx] = e.target.value
                                 onUpdate(product.id, "images", newImgs)
                              }}
                              placeholder={`URL Imagen ${idx + 1}`}
                              className="h-8 text-xs"
                           />
                           {product.images[idx] ? (
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => window.open(product.images[idx], '_blank')}>
                                 <ExternalLink className="w-3 h-3" />
                              </Button>
                           ) : (
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600" onClick={handleImageSearch} title="Buscar en Google Images">
                                 <Search className="w-3 h-3" />
                              </Button>
                           )}
                        </div>
                      ))}
                    </div>
                    <Button variant="outline" size="sm" className="w-full text-xs" onClick={handleImageSearch}>
                       <Search className="w-3 h-3 mr-2" /> Buscar en Google
                    </Button>
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

                    <TabsContent value="preview" className="p-6 m-0 h-full">
                       <div className="prose prose-sm max-w-none bg-white p-8 rounded-lg border shadow-sm mx-auto min-h-[400px]">
                          {product.bodyHtml ? (
                             <div dangerouslySetInnerHTML={{ __html: product.bodyHtml }} />
                          ) : (
                             <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground opacity-50">
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

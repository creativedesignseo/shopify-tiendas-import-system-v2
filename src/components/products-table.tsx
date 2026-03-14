import * as React from "react"
import { cn } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { ProcessedProduct } from "@/lib/product-processor"
import { Check, AlertCircle, Loader2, Settings2, ExternalLink, Search, Sparkles, Image as ImageIcon } from "lucide-react"
import { MasterData } from "@/lib/csv-parser"
import { ProductReviewDialog } from "./product-review-dialog"

interface ProductsTableProps {
  products: ProcessedProduct[]
  masterData: MasterData | null
  onUpdateProduct: (id: string, fieldOrUpdates: string | Partial<ProcessedProduct>, value?: any) => void
  onRemoveProduct: (id: string) => void
}

export function ProductsTable({
  products,
  masterData,
  onUpdateProduct,
  onRemoveProduct,
}: ProductsTableProps) {
  // State for Review Dialog
  const [reviewProductId, setReviewProductId] = React.useState<string | null>(null)
  
  if (products.length === 0) {
    return (
      <div className="text-center py-10 text-[#8C8C8C] rounded-2xl bg-[#F5F6F7]">
        No se han cargado productos. Importa un archivo para comenzar.
      </div>
    )
  }

  const activeProduct = products.find(p => p.id === reviewProductId)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-[#1A1A1A] bg-[#D6F45B]/10 p-3 rounded-xl border border-[#D6F45B]/20">
        <Check className="h-3 w-3 text-green-500" />
        Solo los productos <b>marcados</b> con el checkbox serán incluidos en el archivo de exportación.
      </div>
      {/* Desktop/Tablet Table View */}
      <div className="hidden md:block rounded-xl border border-[#E5E7EB] overflow-x-auto">
        <Table className="min-w-[900px] table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px] text-center uppercase tracking-wider text-[11px] font-medium text-[#8C8C8C]">
                <Switch
                  checked={products.length > 0 && products.every(p => p.isChecked)}
                  onCheckedChange={(checked) => {
                    products.forEach(p => onUpdateProduct(p.id, "isChecked", checked));
                  }}
                  title="Seleccionar todo"
                />
              </TableHead>
              <TableHead className="w-[100px] text-center uppercase tracking-wider text-[11px] font-medium text-[#8C8C8C]">Estado</TableHead>
              <TableHead className="w-auto uppercase tracking-wider text-[11px] font-medium text-[#8C8C8C]">Título</TableHead>
              <TableHead className="w-[110px] uppercase tracking-wider text-[11px] font-medium text-[#8C8C8C]">Marca</TableHead>
              <TableHead className="w-[100px] uppercase tracking-wider text-[11px] font-medium text-[#8C8C8C]">Precio</TableHead>
              <TableHead className="w-[100px] uppercase tracking-wider text-[11px] font-medium text-[#8C8C8C]">Tamaño</TableHead>
              <TableHead className="w-[300px] uppercase tracking-wider text-[11px] font-medium text-[#8C8C8C]">Imágenes</TableHead>
              <TableHead className="w-[150px] uppercase tracking-wider text-[11px] font-medium text-[#8C8C8C]">Etiquetas</TableHead>
              <TableHead className="w-[110px] text-right uppercase tracking-wider text-[11px] font-medium text-[#8C8C8C]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
          {products.map((product) => (
            <TableRow 
              key={product.id} 
              className={cn(
                "transition-colors group/row",
                product.isChecked ? "hover:bg-[#FAFAFA]" : "bg-[#F5F6F7]/50 opacity-70"
              )}
            >
              <TableCell className="text-center">
                <Switch 
                  checked={product.isChecked}
                  onCheckedChange={(checked) => onUpdateProduct(product.id, "isChecked", checked)}
                />
              </TableCell>
              <TableCell className="text-center p-2">
                {product.status === "pending" && (
                  <Badge variant="secondary" className="rounded-full text-[10px] px-2.5 py-0.5 font-medium">
                    En cola
                  </Badge>
                )}
                {product.status === "generating" && (
                  <Badge variant="outline" className="rounded-full text-[10px] px-2.5 py-0.5 font-medium border-[#D6F45B] text-[#1A1A1A]">
                    <Loader2 className="h-3 w-3 animate-spin mr-1" /> Proc.
                  </Badge>
                )}
                {product.status === "complete" && (
                  <Badge
                    className="bg-[#D6F45B] text-[#0F0F0F] rounded-full text-[10px] px-2.5 py-0.5 font-medium border-transparent hover:bg-[#D6F45B]"
                    title={product.modelUsed ? `Generado con ${product.modelUsed}` : 'Listo'}
                  >
                    <Check className="h-3 w-3 mr-1" /> Listo
                  </Badge>
                )}
                {product.status === "error" && (
                  <Badge
                    variant="destructive"
                    className="rounded-full text-[10px] px-2.5 py-0.5 font-medium"
                    title={product.errorDetails || 'Error'}
                  >
                    <AlertCircle className="h-3 w-3 mr-1" /> Error
                  </Badge>
                )}
              </TableCell>
              
              <TableCell className="overflow-hidden">
                <div className="flex flex-col gap-1.5">
                  <Input
                    value={product.generatedTitle}
                    onChange={(e) =>
                      onUpdateProduct(product.id, "generatedTitle", e.target.value)
                    }
                    className="h-8 font-medium transition-colors"
                    placeholder="Título del Producto"
                  />
                  <div className="flex items-center gap-2 text-xs text-[#8C8C8C]">
                     <span className={product.seoTitle.length > 60 ? "text-red-500" : ""}>
                        SEO: {product.seoTitle.length}/60
                     </span>
                     <Input 
                        value={product.seoTitle}
                        onChange={(e) => onUpdateProduct(product.id, "seoTitle", e.target.value)}
                        className="h-6 text-xs w-full transition-colors"
                        placeholder="Título SEO"
                     />
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-[#8C8C8C] italic">
                     <span>Nota:</span>
                     <Input 
                        value={product.observation || ""}
                        onChange={(e) => onUpdateProduct(product.id, "observation", e.target.value)}
                        className="h-6 text-[10px] w-full bg-yellow-50/30 hover:border-amber-200 focus:border-amber-400 transition-colors italic border-dashed"
                        placeholder="Escribe una observación aquí (ej: falta imagen)..."
                     />
                  </div>
                </div>
              </TableCell>

              <TableCell className="truncate max-w-[110px]" title={product.vendor}>{product.vendor}</TableCell>

              <TableCell>
                <Input
                  value={product.price}
                  onChange={(e) =>
                    onUpdateProduct(product.id, "price", e.target.value)
                  }
                  className="h-8 w-20 transition-colors"
                />
              </TableCell>

              <TableCell>
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium">{product.size}</span>
                  {product.unitPrice.isValid ? (
                    <Badge variant="success" className="text-[10px] px-1 h-5 cursor-help" title={`Detectado: ${product.unitPrice.totalMeasure} ${product.unitPrice.totalMeasureUnit}`}>
                      UE OK
                    </Badge>
                  ) : (
                     <Badge variant="destructive" className="text-[10px] px-1 h-5 cursor-help" title="No se pudo detectar unidad">
                      Inválido
                    </Badge>
                  )}
                </div>
              </TableCell>

              <TableCell>
                <div className="flex flex-col gap-3 min-w-[220px]">
                  <div className="flex items-start gap-3">
                    {product.images[0] ? (
                      <div className="relative group/img">
                        <img 
                          src={product.images[0]} 
                          alt={`Vista previa de ${product.title}`}
                          className="h-16 w-16 rounded object-cover border shadow-sm group-hover/img:brightness-90 transition-all"
                        />
                        {/* Hover Overlay with dual search buttons */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 opacity-0 group-hover/img:opacity-100 transition-opacity bg-black/40 rounded backdrop-blur-sm">
                          <button 
                             className="text-[9px] bg-white hover:bg-gray-100 text-black px-1.5 py-0.5 rounded shadow-sm w-[90%] font-semibold"
                             onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(product.vendor + " " + product.title + " perfume bottle")}&tbm=isch`, '_blank')}
                          >
                            Google
                          </button>
                          <button 
                             className="text-[9px] px-1.5 py-0.5 w-[90%] rounded border border-white/40 bg-white/20 hover:bg-white/30 text-white shadow-[0_4px_12px_-2px_rgba(0,0,0,0.1),inset_0_1px_1px_rgba(255,255,255,0.6)] font-semibold"
                             onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(product.vendor + " " + product.title + " perfume bottle site:amazon.com")}&tbm=isch`, '_blank')}
                          >
                            Amazon
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="relative group/img">
                        <div className="h-16 w-16 rounded border bg-[#F5F6F7] flex items-center justify-center text-[10px] text-[#8C8C8C] shadow-sm">
                          Sin img
                        </div>
                        {/* Hover Overlay with dual search buttons */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 opacity-0 group-hover/img:opacity-100 transition-opacity bg-black/40 rounded backdrop-blur-sm">
                          <button 
                             className="text-[9px] bg-white hover:bg-gray-100 text-black px-1.5 py-0.5 rounded shadow-sm w-[90%] font-semibold"
                             onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(product.vendor + " " + product.title + " perfume bottle")}&tbm=isch`, '_blank')}
                          >
                            Google
                          </button>
                          <button 
                             className="text-[9px] px-1.5 py-0.5 w-[90%] rounded border border-white/40 bg-white/20 hover:bg-white/30 text-white shadow-[0_4px_12px_-2px_rgba(0,0,0,0.1),inset_0_1px_1px_rgba(255,255,255,0.6)] font-semibold"
                             onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(product.vendor + " " + product.title + " perfume bottle site:amazon.com")}&tbm=isch`, '_blank')}
                          >
                            Amazon
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="flex flex-col gap-2 flex-1">
                      {/* Image 1 Input */}
                      <div className="flex items-center gap-1">
                        <Input
                          value={product.images[0] || ""}
                          onChange={(e) => {
                            const newImages = [...product.images]
                            newImages[0] = e.target.value
                            onUpdateProduct(product.id, "images", newImages)
                          }}
                          className="h-7 text-xs transition-colors flex-1"
                          placeholder="URL Imagen 1 (Principal)"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-[#8C8C8C] hover:text-[#0F0F0F] cursor-pointer"
                          title={product.images[0] ? "Abrir enlace" : "Buscar en Google"}
                          onClick={() => {
                            if (product.images[0]) {
                              window.open(product.images[0], '_blank');
                            } else {
                              window.open(`https://www.google.com/search?q=${encodeURIComponent(product.vendor + " " + product.title + " perfume bottle")}&tbm=isch`, '_blank');
                            }
                          }}
                        >
                          {product.images[0] ? <ExternalLink className="h-3 w-3" /> : <Search className="h-3 w-3" />}
                        </Button>
                      </div>

                      {/* Image 2 Input */}
                      <div className="flex items-center gap-1">
                        <Input
                          value={product.images[1] || ""}
                          onChange={(e) => {
                            const newImages = [...product.images]
                            newImages[1] = e.target.value
                            onUpdateProduct(product.id, "images", newImages)
                          }}
                          className="h-7 text-xs transition-colors flex-1"
                          placeholder="URL Imagen 2"
                        />
                         <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-[#8C8C8C] hover:text-[#0F0F0F] cursor-pointer"
                          title={product.images[1] ? "Abrir enlace" : "Buscar en Google"}
                          onClick={() => {
                             if (product.images[1]) {
                                window.open(product.images[1], '_blank');
                              } else {
                                window.open(`https://www.google.com/search?q=${encodeURIComponent(product.vendor + " " + product.title + " perfume bottle")}&tbm=isch`, '_blank');
                              }
                          }}
                        >
                          {product.images[1] ? <ExternalLink className="h-3 w-3" /> : <Search className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </TableCell>

              <TableCell>
                <Input
                  value={product.tags}
                  onChange={(e) =>
                    onUpdateProduct(product.id, "tags", e.target.value)
                  }
                  className="h-8 text-xs transition-colors"
                  placeholder="Etiquetas..."
                />
              </TableCell>

              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setReviewProductId(product.id)}
                    className="h-8 px-3 text-xs border-[#EBEBEB] hover:bg-[#F5F6F7] text-[#1A1A1A] hover:border-[#D6F45B]/50 hover:text-[#1A1A1A] pointer-events-auto cursor-pointer"
                  >
                     <Settings2 className="mr-2 h-3 w-3" />
                     Revisar / IA
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {products.map((product) => (
          <div 
            key={product.id} 
            className={cn(
               "bg-white rounded-2xl border shadow-sm p-4 space-y-4 transition-all",
               !product.isChecked && "grayscale opacity-70 bg-[#F5F6F7] border-dashed"
            )}
          >
            {/* Header: Status + Selection + Title */}
            <div className="flex justify-between items-start gap-3">
               <div className="flex-1 space-y-1">
                 <div className="flex items-center gap-2 mb-1">
                    <Switch 
                      checked={product.isChecked}
                      onCheckedChange={(checked) => onUpdateProduct(product.id, "isChecked", checked)}
                      className="mr-1"
                    />
                    {product.status === "complete" && (
                      <Badge className="bg-[#D6F45B] text-[#0F0F0F] rounded-full text-[10px] px-2.5 py-0.5 font-medium border-transparent hover:bg-[#D6F45B]" title={product.modelUsed ? `Generado con ${product.modelUsed}` : 'Listo'}>
                        <Check className="h-3 w-3 mr-1" /> Listo
                      </Badge>
                    )}
                    {product.status === "pending" && (
                      <Badge variant="secondary" className="rounded-full text-[10px] px-2.5 py-0.5 font-medium">
                        En cola
                      </Badge>
                    )}
                    {product.status === "generating" && (
                      <Badge variant="outline" className="rounded-full text-[10px] px-2.5 py-0.5 font-medium border-[#D6F45B] text-[#1A1A1A]">
                        <Loader2 className="h-3 w-3 animate-spin mr-1" /> Proc.
                      </Badge>
                    )}
                    {product.status === "error" && (
                      <Badge variant="destructive" className="rounded-full text-[10px] px-2.5 py-0.5 font-medium" title={product.errorDetails || 'Error'}>
                        <AlertCircle className="h-3 w-3 mr-1" /> Error
                      </Badge>
                    )}
                    <span className="text-xs text-[#8C8C8C]">{product.vendor}</span>
                 </div>
                 <h3 className="font-semibold text-sm leading-tight">{product.generatedTitle || product.title}</h3>
               </div>
               
               {/* Thumbnail */}
               <div className="shrink-0">
                  {product.images[0] ? (
                    <img src={product.images[0]} className="h-16 w-16 rounded-lg object-cover border bg-[#F5F6F7]" alt="" />
                  ) : (
                    <div className="h-16 w-16 rounded-lg border bg-[#EBEBEB] flex items-center justify-center text-[#8C8C8C]">
                      <ImageIcon className="w-6 h-6 opacity-30" />
                    </div>
                  )}
               </div>
            </div>

            {/* Content: Inputs */}
            <div className="space-y-3 pt-2 border-t border-[#EBEBEB]">
               <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-medium text-[#8C8C8C] uppercase">Precio</label>
                    <Input 
                      value={product.price}
                      onChange={(e) => onUpdateProduct(product.id, "price", e.target.value)}
                      className="h-9 mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-[#8C8C8C] uppercase">Tamaño</label>
                    <div className="h-9 flex items-center px-3 bg-[#F5F6F7] rounded-full text-sm mt-1 border border-[#EBEBEB]">
                       {product.size}
                    </div>
                  </div>
               </div>
            </div>

            {/* Actions */}
            <Button 
               onClick={() => setReviewProductId(product.id)}
               className="w-full bg-black text-white hover:bg-black/90 rounded-xl shadow-md h-11"
            >
               <Sparkles className="w-4 h-4 mr-2" />
               Revisar / Generar IA
            </Button>
          </div>
        ))}
      </div>
      {activeProduct && (
        <ProductReviewDialog 
           product={activeProduct}
           masterData={masterData}
           open={!!activeProduct}
           onOpenChange={(open) => {
              if (!open) setReviewProductId(null)
           }}
           onUpdate={onUpdateProduct}
        />
      )}
    </div>
  )
}

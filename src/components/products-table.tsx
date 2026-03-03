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
      <div className="hidden md:block rounded-2xl border border-[#EBEBEB] overflow-x-auto">
        <Table className="min-w-[900px] table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[45px]">
                <Switch 
                  checked={products.length > 0 && products.every(p => p.isChecked)}
                  onCheckedChange={(checked) => {
                    products.forEach(p => onUpdateProduct(p.id, "isChecked", checked));
                  }}
                  title="Seleccionar todo"
                />
              </TableHead>
              <TableHead className="w-[85px] text-center">Estado</TableHead>
              <TableHead className="w-auto">Título</TableHead>
              <TableHead className="w-[110px]">Marca</TableHead>
              <TableHead className="w-[100px]">Precio</TableHead>
              <TableHead className="w-[100px]">Tamaño</TableHead>
              <TableHead className="w-[300px]">Imágenes</TableHead>
              <TableHead className="w-[150px]">Etiquetas</TableHead>
              <TableHead className="w-[110px] text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
          {products.map((product) => (
            <TableRow 
              key={product.id} 
              className={cn(
                "transition-colors group/row",
                product.isChecked ? "hover:bg-[#F5F6F7]" : "bg-[#F5F6F7]/50 grayscale-[0.5] opacity-80"
              )}
            >
              <TableCell>
                <Switch 
                  checked={product.isChecked}
                  onCheckedChange={(checked) => onUpdateProduct(product.id, "isChecked", checked)}
                />
              </TableCell>
              <TableCell className="text-center p-2">
                {product.status === "pending" && (
                  <Badge variant="secondary" className="bg-red-50 text-red-600 border border-red-200 shadow-sm font-bold text-[10px] px-2 whitespace-nowrap">
                    En cola
                  </Badge>
                )}
                {product.status === "generating" && (
                  <Badge variant="secondary" className="bg-[#D6F45B]/10 text-[#0F0F0F] border border-[#D6F45B]/30 shadow-sm font-bold text-[10px] px-2 whitespace-nowrap">
                    <Loader2 className="h-3 w-3 animate-spin mr-1 inline" /> Proc.
                  </Badge>
                )}
                {product.status === "complete" && (
                  <Badge 
                    variant="secondary" 
                    className="bg-green-50 text-green-600 border border-green-200 shadow-sm font-bold text-[10px] px-2 whitespace-nowrap cursor-help"
                    title={product.modelUsed ? `Generado con ${product.modelUsed}` : 'Generación lista'}
                  >
                    <Check className="h-3 w-3 mr-1 inline" /> Listo
                  </Badge>
                )}
                {product.status === "error" && (
                  <Badge 
                    variant="secondary" 
                    className="bg-red-50 text-red-600 border border-red-200 shadow-sm font-bold text-[10px] px-2 whitespace-nowrap cursor-help"
                    title={product.errorDetails || 'Error al procesar'}
                  >
                    <AlertCircle className="h-3 w-3 mr-1 inline" /> Error
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
                    className="h-8 font-medium hover:border-[#D6F45B]/50 focus:border-[#D6F45B] transition-colors"
                    placeholder="Título del Producto"
                  />
                  <div className="flex items-center gap-2 text-xs text-[#8C8C8C]">
                     <span className={product.seoTitle.length > 60 ? "text-red-500" : ""}>
                        SEO: {product.seoTitle.length}/60
                     </span>
                     <Input 
                        value={product.seoTitle}
                        onChange={(e) => onUpdateProduct(product.id, "seoTitle", e.target.value)}
                        className="h-6 text-xs w-full hover:border-[#D6F45B]/50 focus:border-[#D6F45B] transition-colors"
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
                  className="h-8 w-20 hover:border-[#D6F45B]/50 focus:border-[#D6F45B] transition-colors"
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
                      <img 
                        src={product.images[0]} 
                        alt={`Vista previa de ${product.title}`}
                        className="h-16 w-16 rounded object-cover border cursor-pointer hover:scale-105 hover:border-[#D6F45B] transition-all shadow-sm"
                        onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(product.vendor + " " + product.title + " perfume bottle")}&tbm=isch`, '_blank')}
                        title="Buscar en Google"
                      />
                    ) : (
                      <div 
                        className="h-16 w-16 rounded border bg-[#F5F6F7] flex items-center justify-center text-[10px] text-[#8C8C8C] cursor-pointer hover:bg-[#EBEBEB] transition-colors"
                        onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(product.vendor + " " + product.title + " perfume bottle")}&tbm=isch`, '_blank')}
                        title="Buscar en Google"
                      >
                        Sin img
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
                          className="h-7 text-xs hover:border-[#D6F45B]/50 focus:border-[#D6F45B] transition-colors flex-1"
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
                          className="h-7 text-xs hover:border-[#D6F45B]/50 focus:border-[#D6F45B] transition-colors flex-1"
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
                  className="h-8 text-xs hover:border-[#D6F45B]/50 focus:border-[#D6F45B] transition-colors"
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
               "bg-white rounded-xl border shadow-sm p-4 space-y-4 transition-all",
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
                      <Badge variant="secondary" className="bg-green-50 text-green-600 border border-green-200 font-bold text-[10px] px-2 h-5 cursor-help" title={product.modelUsed ? `Generado con ${product.modelUsed}` : 'Listo'}>
                        <Check className="w-3 h-3 mr-1" /> Listo
                      </Badge>
                    )}
                    {product.status === "pending" && (
                      <Badge variant="secondary" className="bg-red-50 text-red-600 border border-red-200 font-bold text-[10px] px-2 h-5">
                        En cola
                      </Badge>
                    )}
                    {product.status === "generating" && (
                      <Badge variant="secondary" className="bg-[#D6F45B]/10 text-[#0F0F0F] border border-[#D6F45B]/30 font-bold text-[10px] px-2 h-5">
                        <Loader2 className="h-3 w-3 animate-spin mr-1 inline" /> Proc.
                      </Badge>
                    )}
                    {product.status === "error" && (
                      <Badge variant="secondary" className="bg-red-50 text-red-600 border border-red-200 font-bold text-[10px] px-2 h-5 cursor-help" title={product.errorDetails || 'Error al procesar'}>
                         <AlertCircle className="h-3 w-3 mr-1 inline" /> Error
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
               className="w-full bg-black text-white hover:bg-black/90 rounded-full shadow-md h-11"
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

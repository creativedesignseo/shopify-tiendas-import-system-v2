import * as React from "react"
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
import { ProcessedProduct } from "@/lib/product-processor"
import { Check, AlertCircle, Loader2, FileText, Settings2, ExternalLink, Search } from "lucide-react"
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
      <div className="text-center py-10 text-muted-foreground border rounded-lg bg-muted/20">
        No se han cargado productos. Importa un archivo para comenzar.
      </div>
    )
  }

  const activeProduct = products.find(p => p.id === reviewProductId)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-blue-50/50 p-2 rounded-md border border-blue-100">
        <Check className="h-3 w-3 text-green-500" />
        Solo los productos marcados como <b>"Listo"</b> serán incluidos en el archivo de exportación para Shopify.
      </div>
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">Estado</TableHead>
              <TableHead className="min-w-[200px]">Título</TableHead>
              <TableHead>Marca</TableHead>
              <TableHead className="w-[100px]">Precio</TableHead>
              <TableHead className="w-[100px]">Tamaño</TableHead>
              <TableHead className="w-[300px]">Imágenes</TableHead>
              <TableHead>Etiquetas</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
          {products.map((product) => (
            <TableRow key={product.id} className="transition-colors hover:bg-accent/40 group/row">
              <TableCell>
                {product.status === "pending" && (
                  <Badge variant="outline" className="text-muted-foreground">
                    En cola
                  </Badge>
                )}
                {product.status === "generating" && (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                )}
                {product.status === "complete" && (
                  <div className="flex flex-col items-center gap-1">
                     <Check className="h-4 w-4 text-green-500" />
                     {product.modelUsed && (
                       <Badge variant="outline" className="text-[9px] h-4 px-1 py-0 border-blue-200 text-blue-700 bg-blue-50 cursor-help" title={`Generado con ${product.modelUsed}`}>
                         {product.modelUsed.replace("gemini-", "").replace("-flash", "")}
                       </Badge>
                     )}
                  </div>
                )}
                {product.status === "error" && (
                  <div className="flex flex-col items-center cursor-help">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    {product.errorDetails && (
                       <span className="text-[10px] text-red-400 mt-1 max-w-[100px] truncate" title={product.errorDetails}>
                        Err
                      </span>
                    )}
                  </div>
                )}
              </TableCell>
              
              <TableCell>
                <div className="flex flex-col gap-2">
                  <Input
                    value={product.generatedTitle}
                    onChange={(e) =>
                      onUpdateProduct(product.id, "generatedTitle", e.target.value)
                    }
                    className="h-8 font-medium hover:border-blue-400 focus:border-blue-500 transition-colors"
                    placeholder="Título del Producto"
                  />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                     <span className={product.seoTitle.length > 60 ? "text-red-500" : ""}>
                        SEO: {product.seoTitle.length}/60
                     </span>
                     <Input 
                        value={product.seoTitle}
                        onChange={(e) => onUpdateProduct(product.id, "seoTitle", e.target.value)}
                        className="h-6 text-xs w-full hover:border-blue-400 focus:border-blue-500 transition-colors"
                        placeholder="Título SEO"
                     />
                  </div>
                </div>
              </TableCell>

              <TableCell>{product.vendor}</TableCell>

              <TableCell>
                <Input
                  value={product.price}
                  onChange={(e) =>
                    onUpdateProduct(product.id, "price", e.target.value)
                  }
                  className="h-8 w-20 hover:border-blue-400 focus:border-blue-500 transition-colors"
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
                <div className="flex flex-col gap-3 min-w-[280px]">
                  <div className="flex items-start gap-3">
                    {product.images[0] ? (
                      <img 
                        src={product.images[0]} 
                        alt="Preview" 
                        className="h-16 w-16 rounded object-cover border cursor-pointer hover:scale-105 hover:border-blue-500 transition-all shadow-sm"
                        onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(product.vendor + " " + product.title + " perfume bottle")}&tbm=isch`, '_blank')}
                        title="Buscar en Google"
                      />
                    ) : (
                      <div 
                        className="h-16 w-16 rounded border bg-muted flex items-center justify-center text-[10px] text-muted-foreground cursor-pointer hover:bg-muted/80 transition-colors"
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
                          className="h-7 text-xs hover:border-blue-400 focus:border-blue-500 transition-colors flex-1"
                          placeholder="URL Imagen 1 (Principal)"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-blue-600 cursor-pointer"
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
                          className="h-7 text-xs hover:border-blue-400 focus:border-blue-500 transition-colors flex-1"
                          placeholder="URL Imagen 2"
                        />
                         <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-blue-600 cursor-pointer"
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
                  className="h-8 text-xs hover:border-blue-400 focus:border-blue-500 transition-colors"
                  placeholder="Etiquetas..."
                />
              </TableCell>

              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setReviewProductId(product.id)}
                    className="h-8 px-3 text-xs border-blue-200 hover:bg-blue-50 text-blue-700 pointer-events-auto cursor-pointer"
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
    </div>
  )
}

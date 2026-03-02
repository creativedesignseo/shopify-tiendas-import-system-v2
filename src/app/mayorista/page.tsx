import * as React from "react"
import { FileDropzone } from "@/components/file-dropzone"
import { parseWholesaleCSV, CatalogData } from "@/lib/csv-catalog-parser"
import { generateWholesalePDF, PdfFormat } from "@/lib/pdf-generator"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { FileText, Download, Loader2, AlertCircle, Smartphone, Monitor } from "lucide-react"

export default function MayoristaPage() {
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const [statusText, setStatusText] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [discountRate, setDiscountRate] = React.useState(65)
  const [pdfFormat, setPdfFormat] = React.useState<PdfFormat>("mobile")
  
  const abortControllerRef = React.useRef<AbortController | null>(null)

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }

  const handleFileSelect = async (file: File) => {
    // Create new abort controller for this run
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

    try {
      setError(null)
      setIsProcessing(true)
      setProgress(5)
      setStatusText("Leyendo CSV y agrupando productos...")

      // 1. Parsing and grouped
      const catalogData = await parseWholesaleCSV(
        file, 
        (100 - discountRate) / 100, 
        (pct: number) => {
           setProgress(Math.min(pct, 30))
        }, 
        signal
      )

      if (catalogData.totalProducts === 0) {
         throw new Error("No se encontraron productos con formato válido en el CSV.")
      }

      // 2. Generation of PDF
      await generateWholesalePDF(catalogData, pdfFormat, (pct, status) => {
         setProgress(Math.max(30, pct))
         setStatusText(status)
      }, signal)

      setIsProcessing(false)
      setProgress(100)
      setStatusText("¡Catálogo Completado!")

    } catch (err: any) {
      console.error(err)
      if (err.message && err.message.includes("cancelada")) {
         setError("Operación cancelada por el usuario. El catálogo no se generó completo.")
      } else {
         setError(err.message || "Error al generar el PDF")
      }
      setIsProcessing(false)
    } finally {
      abortControllerRef.current = null
    }
  }

  return (
    <main className="container mx-auto p-4 sm:p-8 space-y-8 min-h-screen bg-gray-50">
      <div className="flex flex-col gap-2 max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Generador de Catálogo Mayorista</h1>
        <p className="text-muted-foreground text-lg">Convierte tu CSV de exportación de Shopify en un catálogo PDF profesional en segundos, listo para enviar por WhatsApp o Correo.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="shadow-lg border-0 ring-1 ring-gray-200">
          <CardHeader className="bg-white rounded-t-xl pb-4 border-b border-gray-100">
            <CardTitle className="flex items-center gap-2 text-xl">
               <FileText className="h-5 w-5 text-blue-600" /> 
               Configuración del Catálogo
            </CardTitle>
            <CardDescription className="text-sm">
              Ajusta el diseño y el precio antes de subir tu archivo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8 pt-6 pb-6 bg-white rounded-b-xl">
            
             {/* Format Selector */}
             <div className="space-y-3">
               <label className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                 1. Formato de Lectura
               </label>
               <div className="grid grid-cols-2 gap-3 p-1 bg-gray-100 rounded-xl">
                 <button
                   onClick={() => setPdfFormat("mobile")}
                   className={`flexflex-col items-center justify-center py-3 px-2 rounded-lg transition-all duration-200 ${
                     pdfFormat === "mobile" 
                       ? "bg-white shadow-sm ring-1 ring-gray-200 text-blue-600 font-medium" 
                       : "text-gray-500 hover:text-gray-900"
                   }`}
                 >
                   <div className="flex items-center justify-center gap-2 mb-1">
                     <Smartphone className="w-5 h-5" />
                     <span>Móvil</span>
                   </div>
                   <span className="text-xs opacity-70 block font-normal text-center">Vertical (9:16)</span>
                 </button>
                 
                 <button
                   onClick={() => setPdfFormat("desktop")}
                   className={`flex flex-col items-center justify-center py-3 px-2 rounded-lg transition-all duration-200 ${
                     pdfFormat === "desktop" 
                       ? "bg-white shadow-sm ring-1 ring-gray-200 text-blue-600 font-medium" 
                       : "text-gray-500 hover:text-gray-900"
                   }`}
                 >
                   <div className="flex items-center justify-center gap-2 mb-1">
                     <Monitor className="w-5 h-5" />
                     <span>Escritorio</span>
                   </div>
                   <span className="text-xs opacity-70 block font-normal text-center">Clásico (A4)</span>
                 </button>
               </div>
             </div>

             {/* Minimalist Big Discount Slider */}
             <div className="space-y-4 pt-2">
               <div className="flex items-end justify-between">
                 <label htmlFor="discount" className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                   2. Descuento (% OFF)
                 </label>
                 <div className="text-4xl font-black text-blue-600 tracking-tighter">
                   {discountRate}%
                 </div>
               </div>
               
               <div className="relative pt-2 pb-2">
                 <input 
                   id="discount"
                   type="range" 
                   min="0" 
                   max="100" 
                   value={discountRate}
                   onChange={(e) => setDiscountRate(Number(e.target.value))}
                   className="w-full h-4 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-600 outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                 />
                 <div className="flex justify-between text-xs text-gray-400 mt-2 font-medium px-1">
                    <span>0% (Retail)</span>
                    <span>100% (Gratis)</span>
                 </div>
               </div>
               
               <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100/50">
                 <p className="text-sm text-blue-800 flex items-center gap-2">
                   <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">Resumen</span>
                   Multiplicaremos tus precios por <strong className="font-bold">{((100 - discountRate) / 100).toFixed(2)}</strong>.
                 </p>
               </div>
             </div>

             <div className="pt-4 border-t border-gray-100 space-y-3">
               <label className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                 3. Archivo Exportado
               </label>
               <FileDropzone 
                  onFileSelect={handleFileSelect} 
                  accept=".csv"
                  label="Arrastra el CSV de Shopify aquí"
                  disabled={isProcessing}
               />
             </div>
          </CardContent>
        </Card>

        {/* Processing State Card */}
        <Card className="shadow-sm border-blue-100 bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
               Estado del Procesamiento
            </CardTitle>
            <CardDescription>
              El PDF se genera directamente en tu navegador.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!isProcessing && progress === 0 && !error && (
              <div className="text-center py-8 text-muted-foreground bg-gray-50 rounded-md border border-dashed">
                Esperando archivo CSV...
              </div>
            )}

            {(isProcessing || progress > 0) && !error && (
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm font-medium">
                  <span className="flex items-center gap-2">
                    {isProcessing && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                    {statusText}
                  </span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-3" />
                
                {progress === 100 && !isProcessing && (
                  <div className="pt-4 flex justify-center">
                     <Button className="w-full bg-green-600 hover:bg-green-700 text-white">
                        <Download className="mr-2 w-4 h-4" />
                        Descargar PDF Nuevamente
                     </Button>
                  </div>
                )}
                
                {isProcessing && (
                  <div className="pt-2 flex justify-center">
                     <Button variant="outline" className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200" onClick={handleCancel}>
                        Cancelar Proceso
                     </Button>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 text-red-700 rounded-md border border-red-200 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold">Error de Procesamiento</h4>
                  <p className="text-sm mt-1">{error}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

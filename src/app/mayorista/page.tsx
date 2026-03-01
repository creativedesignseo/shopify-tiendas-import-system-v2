"use client"

import * as React from "react"
import { FileDropzone } from "@/components/file-dropzone"
import { parseWholesaleCSV, CatalogData } from "@/lib/csv-catalog-parser"
import { generateWholesalePDF } from "@/lib/pdf-generator"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { FileText, Download, Loader2, AlertCircle } from "lucide-react"

export default function MayoristaPage() {
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const [statusText, setStatusText] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  
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
      const catalogData = await parseWholesaleCSV(file, (pct) => {
         setProgress(Math.min(pct, 30))
      }, signal)

      if (catalogData.totalProducts === 0) {
         throw new Error("No se encontraron productos con formato válido en el CSV.")
      }

      // 2. Generation of PDF
      await generateWholesalePDF(catalogData, (pct, status) => {
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
    <main className="container mx-auto p-8 space-y-8 min-h-screen bg-gray-50">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Generador de Catálogo Mayorista</h1>
        <p className="text-muted-foreground">Convierte tu CSV de exportación de Shopify en un catálogo PDF en segundos.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
               <FileText className="h-5 w-5" /> 
               Sube la Colección Completa
            </CardTitle>
            <CardDescription>
              Arrastra aquí tu "products_export.csv" de Shopify. El sistema calculará el precio mayorista (35%) y estructurará el PDF por categorías.
            </CardDescription>
          </CardHeader>
          <CardContent>
             <FileDropzone 
                onFileSelect={handleFileSelect} 
                accept=".csv"
                label="Arrastra el CSV de Shopify"
                disabled={isProcessing}
             />
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

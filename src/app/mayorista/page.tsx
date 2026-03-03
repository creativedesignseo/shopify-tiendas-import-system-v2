"use client"

import * as React from "react"
import { FileDropzone } from "@/components/file-dropzone"
import { parseWholesaleCSV, CatalogData } from "@/lib/csv-catalog-parser"
import { generateWholesalePDF, PdfFormat } from "@/lib/pdf-generator"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { FileText, Download, Loader2, AlertCircle, Smartphone, Monitor, Layers, CloudDownload } from "lucide-react"

export default function MayoristaPage() {
  // Config State
  const [discountRate, setDiscountRate] = React.useState(65)
  const [pdfFormat, setPdfFormat] = React.useState<PdfFormat>("mobile")

  // Processing State
  const [isParsing, setIsParsing] = React.useState(false)
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const [statusText, setStatusText] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  
  // Data State
  const [parsedData, setParsedData] = React.useState<CatalogData | null>(null)
  const [availableCategories, setAvailableCategories] = React.useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = React.useState<string[]>([])
  const [hasGeneratedOnce, setHasGeneratedOnce] = React.useState(false)

  const abortControllerRef = React.useRef<AbortController | null>(null)

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }

  // Phase 1: Read CSV, Parse, Group, and Extract Categories
  const handleFileSelect = async (file: File) => {
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

    try {
      setError(null)
      setIsParsing(true)
      setHasGeneratedOnce(false)
      setProgress(10)
      setStatusText("Leyendo CSV y clasificando...")

      const catalogData = await parseWholesaleCSV(
        file, 
        (100 - discountRate) / 100, 
        (pct: number) => {
           setProgress(Math.min(pct, 100))
        }, 
        signal
      )

      if (catalogData.totalProducts === 0) {
         throw new Error("No se encontraron productos válidos en el CSV.")
      }

      // Extract unique categories
      const categories = Object.keys(catalogData.categories).sort()
      setAvailableCategories(categories)
      setSelectedCategories(categories) // Select all by default
      setParsedData(catalogData)
      setIsParsing(false)
      setStatusText("Categorías extraídas exitosamente.")
      
    } catch (err: any) {
      console.error(err)
      if (err.message && err.message.includes("cancelada")) {
         setError("Lectura cancelada por el usuario.")
      } else {
         setError(err.message || "Error al leer el archivo CSV")
      }
      setIsParsing(false)
    } finally {
      abortControllerRef.current = null
    }
  }

  // Phase 2: Filter Data and Generate PDF
  const handleGeneratePdf = async () => {
    if (!parsedData) return

    if (selectedCategories.length === 0) {
      setError("Debes seleccionar al menos una categoría para generar el catálogo.")
      return
    }

    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

    try {
      setError(null)
      setIsGenerating(true)
      setProgress(5)
      setStatusText("Iniciando motor PDF...")

      // Filter categorized data based on selection
      const filteredCategories: Record<string, any[]> = {}
      let totalFilteredProducts = 0

      selectedCategories.forEach(cat => {
        if (parsedData.categories[cat]) {
          filteredCategories[cat] = parsedData.categories[cat]
          totalFilteredProducts += parsedData.categories[cat].length
        }
      })

      const filteredData: CatalogData = {
        categories: filteredCategories,
        totalProducts: totalFilteredProducts
      }

      await generateWholesalePDF(filteredData, pdfFormat, (pct, status) => {
         setProgress(pct)
         setStatusText(status)
      }, signal)

      setIsGenerating(false)
      setHasGeneratedOnce(true)
      setStatusText("¡Catálogo generado y descargado!")

    } catch (err: any) {
      console.error(err)
      if (err.message && err.message.includes("cancelada")) {
         setError("Renderizado PDF cancelado por el usuario.")
      } else {
         setError(err.message || "Error al construir el PDF")
      }
      setIsGenerating(false)
    } finally {
      abortControllerRef.current = null
    }
  }

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    )
  }

  const selectAllCategories = () => setSelectedCategories(availableCategories)
  const clearCategories = () => setSelectedCategories([])

  return (
    <main className="container mx-auto p-4 sm:p-8 space-y-8 min-h-screen">
      <div className="flex flex-col gap-2 max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-[#1A1A1A]">Generador de Catálogo Mayorista</h1>
        <p className="text-[#8C8C8C] text-lg">Crea un catálogo PDF interactivo y a medida. Elige tu formato, aplica descuentos y selecciona solo las colecciones que deseas incluir.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Form Settings & File Upload */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-4 border-b border-[#EBEBEB]">
              <CardTitle className="flex items-center gap-2 text-xl">
                 <FileText className="h-5 w-5 text-[#D6F45B]" /> 
                 1. Configuración Base
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8 pt-6 pb-6">
              
               {/* Format Selector */}
               <div className="space-y-3">
                 <label className="text-sm font-semibold text-[#8C8C8C] uppercase tracking-wider">
                   Formato de Lectura
                 </label>
                 <div className="grid grid-cols-2 gap-3 p-1.5 bg-[#F5F6F7] rounded-2xl">
                   <button
                     onClick={() => setPdfFormat("mobile")}
                     className={`flex flex-col items-center justify-center py-3 px-2 rounded-xl transition-all duration-250 ${
                       pdfFormat === "mobile" 
                         ? "bg-white shadow-[0_4px_12px_rgba(0,0,0,0.06)] text-[#0F0F0F] font-medium scale-[1.02]" 
                         : "text-[#8C8C8C] hover:text-[#1A1A1A]"
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
                     className={`flex flex-col items-center justify-center py-3 px-2 rounded-xl transition-all duration-250 ${
                       pdfFormat === "desktop" 
                         ? "bg-white shadow-[0_4px_12px_rgba(0,0,0,0.06)] text-[#0F0F0F] font-medium scale-[1.02]" 
                         : "text-[#8C8C8C] hover:text-[#1A1A1A]"
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
                   <label htmlFor="discount" className="text-sm font-semibold text-[#8C8C8C] uppercase tracking-wider">
                     Descuento (Mayorista)
                   </label>
                   <div className="text-4xl font-black text-[#0F0F0F] tracking-tighter">
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
                     onChange={(e) => {
                       setDiscountRate(Number(e.target.value))
                       if (parsedData) {
                          setParsedData(null)
                          setHasGeneratedOnce(false)
                          setStatusText("Descuento cambiado. Por favor, vuelve a subir el archivo CSV.")
                       }
                     }}
                     className="w-full h-3 bg-[#EBEBEB] rounded-full appearance-none cursor-pointer accent-[#D6F45B] outline-none focus:ring-4 focus:ring-[#D6F45B]/15 transition-all"
                   />
                   <div className="flex justify-between text-xs text-[#8C8C8C] mt-2 font-medium px-1">
                      <span>0% (Retail)</span>
                      <span>100% (Gratis)</span>
                   </div>
                 </div>
                 
                 <div className="bg-[#0F0F0F] p-4 rounded-2xl">
                   <p className="text-sm text-white/80 flex items-center gap-2">
                     <span className="bg-[#D6F45B] text-[#0F0F0F] px-2.5 py-0.5 rounded-full text-xs font-bold">Resumen</span>
                     Multiplicaremos tus precios por <strong className="font-bold text-white">{((100 - discountRate) / 100).toFixed(2)}</strong>.
                   </p>
                 </div>
               </div>
            </CardContent>
          </Card>

          <Card className={`transition-all duration-300 ${parsedData ? 'ring-2 ring-[#D6F45B]/50' : ''}`}>
            <CardHeader className="pb-4 border-b border-[#EBEBEB]">
              <CardTitle className="flex items-center gap-2 text-xl">
                 <Layers className={`h-5 w-5 ${parsedData ? 'text-green-500' : 'text-[#D6F45B]'}`} /> 
                 2. Cargar Inventario
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
               {!parsedData && (
                 <FileDropzone 
                    onFileSelect={handleFileSelect} 
                    accept=".csv"
                    label="Arrastra el Export de Shopify aquí"
                    disabled={isParsing || isGenerating}
                 />
               )}
               {parsedData && (
                 <div className="flex flex-col items-center justify-center p-6 bg-[#F5F6F7] rounded-2xl">
                    <div className="w-12 h-12 bg-[#D6F45B]/20 rounded-2xl flex items-center justify-center mb-3">
                      <CloudDownload className="w-6 h-6 text-[#0F0F0F]" />
                    </div>
                    <h3 className="font-bold text-lg text-[#1A1A1A]">CSV Cargado Exitosamente</h3>
                    <p className="text-sm text-[#8C8C8C] mb-4">{parsedData.totalProducts} productos detectados</p>
                    <Button variant="outline" size="sm" onClick={() => {
                      setParsedData(null)
                      setHasGeneratedOnce(false)
                      setStatusText("")
                    }}>
                       Subir otro archivo
                    </Button>
                 </div>
               )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Category Selection & Generation */}
        <div className="space-y-6">
          <Card className={`h-full min-h-[500px] flex flex-col transition-all duration-300 ${parsedData ? 'ring-2 ring-[#D6F45B]/30' : 'opacity-70'}`}>
            <CardHeader className="pb-4 border-b border-[#EBEBEB]">
              <CardTitle className="flex items-center gap-2 text-xl">
                 <Smartphone className="h-5 w-5 text-[#D6F45B]" /> 
                 3. Personalizar y Generar
              </CardTitle>
              <CardDescription>
                 {parsedData ? "Selecciona qué categorías incluir en el PDF." : "Sube el archivo primero para ver las categorías disponibles."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow pt-6 flex flex-col">
              
              {!parsedData && !isParsing && (
                 <div className="flex-grow flex items-center justify-center text-[#8C8C8C]">
                    <p className="text-center px-8">Las opciones de generación aparecerán aquí una vez que subas tu archivo CSV.</p>
                 </div>
              )}

              {/* Progress UI for Parsing */}
              {isParsing && (
                 <div className="flex-grow flex flex-col items-center justify-center space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin text-[#D6F45B]" />
                    <p className="text-sm font-medium text-[#8C8C8C]">{statusText}</p>
                 </div>
              )}

              {/* Category Checkboxes */}
              {parsedData && !isParsing && (
                <div className="space-y-6 flex-grow flex flex-col">
                  
                  <div className="flex items-center justify-between border-b border-[#EBEBEB] pb-2">
                    <h3 className="font-semibold text-[#1A1A1A]">Selección de Categorías</h3>
                    <div className="flex gap-2">
                      <button onClick={selectAllCategories} className="text-xs font-medium text-[#0F0F0F] hover:text-[#D6F45B] transition-colors">
                        Seleccionar Todas
                      </button>
                      <span className="text-[#EBEBEB]">|</span>
                      <button onClick={clearCategories} className="text-xs font-medium text-[#8C8C8C] hover:text-[#1A1A1A] transition-colors">
                        Limpiar
                      </button>
                    </div>
                  </div>

                  <div className="flex-grow overflow-y-auto max-h-[300px] pr-2 space-y-2">
                    {availableCategories.map(cat => (
                      <div key={cat} className="relative flex items-center space-x-3 p-3 bg-[#F5F6F7] rounded-xl hover:bg-[#D6F45B]/5 transition-colors border border-transparent hover:border-[#D6F45B]/20 focus-within:ring-2 focus-within:ring-[#D6F45B]/15">
                        <Switch 
                          id={`cat-${cat}`} 
                          checked={selectedCategories.includes(cat)}
                          onCheckedChange={() => toggleCategory(cat)}
                          className="z-10"
                        />
                        <label 
                           htmlFor={`cat-${cat}`} 
                           className="absolute inset-0 w-full h-full cursor-pointer rounded-xl z-0"
                        >
                           <span className="sr-only">Seleccionar categoría {cat}</span>
                        </label>
                        <div className="grid gap-1.5 leading-none flex-grow pointer-events-none z-10">
                          <span className="text-sm font-medium leading-none text-[#1A1A1A]">
                            {cat}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-[#8C8C8C] bg-[#EBEBEB] px-2.5 py-0.5 rounded-full pointer-events-none z-10">
                          {parsedData.categories[cat].length}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-[#EBEBEB] mt-auto">
                    {/* Progress Indicator for Generation */}
                    {(isGenerating || progress > 0) && (
                      <div className="space-y-3 mb-6 bg-[#0F0F0F] p-4 rounded-2xl">
                        <div className="flex justify-between items-center text-sm font-medium">
                          <span className="flex items-center gap-2 text-white/80">
                            {isGenerating && <Loader2 className="h-4 w-4 animate-spin text-[#D6F45B]" />}
                            {statusText}
                          </span>
                          <span className="text-[#D6F45B] font-bold">{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                        
                        {isGenerating && (
                           <Button variant="ghost" size="sm" className="w-full mt-2 text-red-400 hover:bg-red-500/10 hover:text-red-300" onClick={handleCancel}>
                              Cancelar y detener
                           </Button>
                        )}
                      </div>
                    )}

                    {error && (
                      <div className="p-4 mb-4 bg-red-50 text-red-700 rounded-2xl border border-red-200 flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                        <p className="text-sm font-medium">{error}</p>
                      </div>
                    )}

                    <Button 
                      size="lg"
                      className={`w-full text-base h-14 font-semibold ${
                         hasGeneratedOnce 
                         ? "bg-green-500 hover:bg-green-600 text-white" 
                         : ""
                      } shadow-lg`}
                      disabled={isGenerating || selectedCategories.length === 0}
                      onClick={handleGeneratePdf}
                    >
                      {isGenerating ? (
                        <>Construyendo Catálogo...</>
                      ) : hasGeneratedOnce ? (
                        <span className="flex items-center gap-2"><Download className="w-5 h-5"/> Generar y Descargar Nuevo Catálogo</span>
                      ) : (
                        <span className="flex items-center gap-2"><FileText className="w-5 h-5"/> ¡Generar Catálogo PDF!</span>
                      )}
                    </Button>
                    {hasGeneratedOnce && !isGenerating && (
                      <p className="text-center text-xs text-[#8C8C8C] mt-3 font-medium">
                         Si cambiaste el formato Móvil/Escritorio o las categorías, presiona este botón para regenerarlo rápido.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}

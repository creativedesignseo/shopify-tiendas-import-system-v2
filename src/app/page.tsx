"use client"

export const dynamic = "force-dynamic";

import Link from "next/link"
import versionData from "@/data/version.json"

import * as React from "react"
import { FileDropzone } from "@/components/file-dropzone"
import { ProductsTable } from "@/components/products-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MasterData, parseMasterCSV } from "@/lib/csv-parser"
import { ProcessedProduct, processNewProducts, SkippedProduct } from "@/lib/product-processor"
import { generateCSV } from "@/lib/csv-exporter"
import { Download, Trash2, FileSpreadsheet, UploadCloud, AlertTriangle, CheckCircle2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn, generateUUID } from "@/lib/utils"
import { BackupService, ImportSession } from "@/lib/backup-service"
import { SettingsDialog } from "@/components/settings-dialog"
import { SessionRecoveryDialog } from "@/components/session-recovery-dialog"
import { FlightProgressBar } from "@/components/flight-progress-bar"
import { ManualProductForm } from "@/components/manual-product-form"
import { ShopifyPublishDialog } from "@/components/shopify-publish-dialog"


export default function Dashboard() {
  const [masterData, setMasterData] = React.useState<MasterData | null>(null)
  const [products, setProducts] = React.useState<ProcessedProduct[]>([])
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  
  // Duplicate Dialog State
  const [skippedProducts, setSkippedProducts] = React.useState<SkippedProduct[]>([])
  const [showSkippedDialog, setShowSkippedDialog] = React.useState(false)

  // Success Dialog State
  const [successCount, setSuccessCount] = React.useState<number>(0)
  const [showSuccessDialog, setShowSuccessDialog] = React.useState(false)

  // Shopify connection indicator & output mode
  const [shopifyConnected, setShopifyConnected] = React.useState(false)
  const [outputMode, setOutputMode] = React.useState("csv_only")
  const [showPublishDialog, setShowPublishDialog] = React.useState(false)
  React.useEffect(() => {
    setShopifyConnected(localStorage.getItem("shopify_connected") === "true")
    setOutputMode(localStorage.getItem("shopify_output_mode") || "csv_only")
  }, [])

  // Session & Backup State
  const [deviceId, setDeviceId] = React.useState<string>("")
  const [currentSession, setCurrentSession] = React.useState<ImportSession | null>(null)
  const [showRecoveryDialog, setShowRecoveryDialog] = React.useState(false)
  const [recoveryProducts, setRecoveryProducts] = React.useState<ProcessedProduct[]>([])
  const [lastSavedAt, setLastSavedAt] = React.useState<Date | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)

  // Manual Entry Mode
  const [step2Mode, setStep2Mode] = React.useState<"csv" | "manual">("csv")

  // Init Device ID & Check for Active Sessions
  React.useEffect(() => {
    // 1. Get or create Device ID
    let did = localStorage.getItem("shopify_importer_device_id")
    if (!did) {
      did = generateUUID()
      localStorage.setItem("shopify_importer_device_id", did)
    }
    setDeviceId(did)

    // 2. Check for active session
    const checkSession = async () => {
       if (!did) return
       const activeSession = await BackupService.getActiveSession(did)
       if (activeSession && activeSession.products.length > 0) {
          setRecoveryProducts(activeSession.products)
          setCurrentSession(activeSession.session)
          setShowRecoveryDialog(true)
       }
    }
    checkSession()

    // 3. Load MasterData from LocalStorage
    const storedMaster = localStorage.getItem("shopify_importer_master_data")
    if (storedMaster) {
      try {
        const parsed = JSON.parse(storedMaster)
        if (parsed.existingBarcodes) {
           parsed.existingBarcodes = new Set(parsed.existingBarcodes)
        }
        if (parsed.existingTitles) {
           parsed.existingTitles = new Set(parsed.existingTitles)
        }
        setMasterData(parsed)
      } catch (e) {
        console.error("Error loading master data from local storage", e)
      }
    }
  }, [])

  // ─── Auto-Save / Checkpoint Effect (Debounced) ─────────────────
  React.useEffect(() => {
    if (!deviceId || products.length === 0) return

    const timeoutId = setTimeout(async () => {
       setIsSaving(true)
       
       if (currentSession) {
         // New session-aware checkpoint
         await BackupService.saveCheckpoint(
           deviceId,
           currentSession.id,
           products,
           currentSession.file_name
         )
         
         // Update local session counters
         const completed = products.filter(p => p.status === 'complete').length
         const failed = products.filter(p => p.status === 'error').length
         setCurrentSession(prev => prev ? {
           ...prev,
           completed_products: completed,
           failed_products: failed,
           updated_at: new Date().toISOString(),
         } : null)
       } else {
         // Legacy fallback
         await BackupService.saveBackup(deviceId, products)
       }
       
       setLastSavedAt(new Date())
       setIsSaving(false)
    }, 3000) // 3s debounce

    return () => clearTimeout(timeoutId)
  }, [products, deviceId, currentSession])

  // ─── Session Recovery Handlers ─────────────────────────────────
  const handleRestore = () => {
    setProducts(recoveryProducts)
    setShowRecoveryDialog(false)
  }

  const handleAbandonSession = async () => {
    if (currentSession) {
      await BackupService.abandonSession(currentSession.id)
    }
    setCurrentSession(null)
    setRecoveryProducts([])
    setShowRecoveryDialog(false)
  }

  const handleDownloadPartial = () => {
    if (!masterData) {
      alert("Se necesita el archivo maestro para generar el CSV. Cárgalo primero.")
      return
    }
    const readyProducts = products.filter(p => p.status === "complete" && p.isChecked)
    if (readyProducts.length === 0) {
      alert("No hay productos completados para descargar.")
      return
    }
    const csvContent = generateCSV(readyProducts, masterData.headers)
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `shopify_parcial_${readyProducts.length}_de_${products.length}.csv`
    link.click()
  }

  // ─── 1. Manejar Archivo Maestro ────────────────────────────────
  const handleMasterFile = async (file: File) => {
    try {
      const data = await parseMasterCSV(file)
      setMasterData(data)
      
      // Persist to LocalStorage (Serialize Set to Array)
      const toStore = {
         ...data,
         existingBarcodes: Array.from(data.existingBarcodes),
         existingTitles: Array.from(data.existingTitles),
      }
      localStorage.setItem("shopify_importer_master_data", JSON.stringify(toStore))

    } catch (error) {
      console.error("Error al procesar CSV Maestro:", error)
      alert("Error al procesar CSV Maestro. Revisa la consola.")
    }
  }

  // ─── 2. Manejar Archivo de Nuevos Productos ────────────────────
  const handleNewFile = async (file: File) => {
    const mode = localStorage.getItem("shopify_output_mode") || "csv_only"
    const isShopifyMode = mode === "shopify_only" || mode === "csv_and_shopify"
    if (!masterData && !isShopifyMode) {
      alert("Por favor, sube primero el CSV Maestro.")
      return
    }
    try {
      const { products: newProducts, skipped, headers } = await processNewProducts(file, masterData)
      
      // Handle duplicates
      if (skipped.length > 0) {
        setSkippedProducts(skipped)
        setShowSkippedDialog(true)
      } else {
        setSkippedProducts([])
        setShowSkippedDialog(false)
      }

      if (newProducts.length === 0) {
        if (skipped.length === 0) {
            const foundHeaders = headers.length > 0 ? headers.join(", ") : "(Ninguna o archivo vacío)";
            alert(`⚠️ ¡No se cargaron datos!

Posibles razones:
1. Archivo vacío o sin filas de datos.
2. No se encontró ninguna columna de "Código de barras" válida.

Cabeceras Encontradas:
${foundHeaders}

Cabeceras Requeridas (Aceptamos variaciones):
- Nombre / Title / Name
- Marca / Vendor / Brand
- Precio / Price / PVP
- Tamaño / Size
- Código de barras / Barcode / SKU / EAN`)
        }
      } else {
        // Filtrar productos que YA están en la tabla (evitar duplicate keys)
        const existingIds = new Set(products.map(p => p.id));
        const trulyNewProducts = newProducts.filter(p => !existingIds.has(p.id));
        
        if (trulyNewProducts.length < newProducts.length) {
          console.warn(`${newProducts.length - trulyNewProducts.length} productos ya estaban en la tabla y fueron omitidos.`);
        }

        if (trulyNewProducts.length > 0) {
          const updatedProducts = [...products, ...trulyNewProducts]
          setProducts(updatedProducts);

          // Create or update session
          if (!currentSession) {
            const session = await BackupService.createSession(
              deviceId,
              file.name,
              updatedProducts.length
            )
            if (session) {
              setCurrentSession(session)
              console.log('📦 Import session started:', session.id, 'for file:', file.name)
            }
          } else {
            // Session already active, just update the total count
            setCurrentSession(prev => prev ? {
              ...prev,
              total_products: updatedProducts.length,
            } : null)
          }

          if (skipped.length === 0) {
            setSuccessCount(trulyNewProducts.length);
            setShowSuccessDialog(true);
          }
        } else if (skipped.length === 0) {
          alert(`ℹ️ Los productos de este archivo ya están en la lista.`);
        }
      }
    } catch (error) {
       console.error("Error al procesar nuevos productos:", error)
       alert("Error al procesar Nuevos Productos. Revisa la consola para más detalles.")
    }
  }

  // ─── 3. Agregar Producto Manual ─────────────────────────────────
  const handleManualAdd = async (product: ProcessedProduct) => {
    const updatedProducts = [...products, product]
    setProducts(updatedProducts)

    // Create or update session
    if (!currentSession) {
      const session = await BackupService.createSession(
        deviceId,
        "manual-entry",
        updatedProducts.length
      )
      if (session) {
        setCurrentSession(session)
        console.log('📦 Manual entry session started:', session.id)
      }
    } else {
      setCurrentSession(prev => prev ? {
        ...prev,
        total_products: updatedProducts.length,
      } : null)
    }
  }

  // ─── 4. Actualizar Producto (Edición Manual) ───────────────────
  const handleUpdateProduct = (id: string, fieldOrUpdates: string | Partial<ProcessedProduct>, value?: any) => {
    setProducts(prev => prev.map(p => {
      if (p.id !== id) return p
      if (typeof fieldOrUpdates === "string") {
        return { ...p, [fieldOrUpdates]: value }
      }
      return { ...p, ...fieldOrUpdates }
    }))
  }

  const handleRemoveProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id))
  }

  // ─── 5. Exportar ───────────────────────────────────────────────
  const downloadCSV = (readyProducts: ProcessedProduct[]) => {
    if (!masterData) return
    const csvArgs = generateCSV(readyProducts, masterData.headers)
    const blob = new Blob([csvArgs], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `shopify_import_${readyProducts.length}_items.csv`
    link.click()
  }

  const handleExport = async () => {
    const readyProducts = products.filter(p => p.status === "complete" && p.isChecked)
    if (readyProducts.length === 0) {
      alert("No hay productos SELECCIONADOS y terminados para exportar.")
      return
    }

    const mode = localStorage.getItem("shopify_output_mode") || "csv_only"

    if (mode === "csv_only") {
      if (!masterData) return
      downloadCSV(readyProducts)
    } else if (mode === "shopify_only") {
      setShowPublishDialog(true)
    } else if (mode === "csv_and_shopify") {
      setShowPublishDialog(true)
    }

    // If all products are complete, mark session as completed
    const allDone = products.every(p => p.status === "complete" || p.status === "error")
    if (allDone && currentSession) {
      await BackupService.completeSession(currentSession.id)
      setCurrentSession(prev => prev ? { ...prev, status: 'completed' } : null)
    }
  }

  const handlePublishComplete = (results: import("@/lib/shopify-client").CreateProductResult[]) => {
    const mode = localStorage.getItem("shopify_output_mode") || "csv_only"
    if (mode === "csv_and_shopify" && masterData) {
      const readyProducts = products.filter(p => p.status === "complete" && p.isChecked)
      downloadCSV(readyProducts)
    }
  }

  // ─── 6. Limpiar Todo ──────────────────────────────────────────
  const handleClearAll = async () => {
    if (confirm("¿Estás seguro? Esto borrará todos los productos y el archivo maestro.")) {
      // Abandon session if active
      if (currentSession && currentSession.status === 'in_progress') {
        await BackupService.abandonSession(currentSession.id)
      }
      setProducts([])
      setMasterData(null)
      setCurrentSession(null)
      localStorage.removeItem("shopify_importer_master_data")
    }
  }

  return (
    <main className="max-w-[1600px] mx-auto px-6 py-8 space-y-8 min-h-screen">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
           <div className="flex items-center gap-3">
             <h1 className="text-3xl font-bold tracking-tight text-[#1A1A1A]">Arquitecto de Importación Shopify</h1>
             <Link
               href="/changelog"
               className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#D6F45B] text-[#0F0F0F] hover:brightness-95 transition-all no-underline"
             >
               v{versionData.current}
             </Link>
           </div>
           <p className="text-[#8C8C8C]">Filtro de duplicados, precios UE y enriquecimiento con IA.</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <SettingsDialog />
              {shopifyConnected && (
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-white" />
              )}
            </div>
            <Button
              variant="outline"
              onClick={handleClearAll}
              disabled={products.length === 0 && !masterData}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Limpiar Todo
            </Button>
            <Button
              onClick={handleExport}
              disabled={!products.some(p => p.status === "complete" && p.isChecked) || (outputMode === "csv_only" && !masterData)}
            >
              <Download className="mr-2 h-4 w-4 shrink-0" />
              {outputMode === "shopify_only"
                ? `Publicar (${products.filter(p => p.status === "complete" && p.isChecked).length})`
                : outputMode === "csv_and_shopify"
                ? `Exportar + Publicar (${products.filter(p => p.status === "complete" && p.isChecked).length})`
                : `Exportar (${products.filter(p => p.status === "complete" && p.isChecked).length})`}
            </Button>
        </div>
      </div>

      {products.some(p => p.status === "pending" || p.status === "error") && (
        <div className="bg-[#0F0F0F] rounded-xl px-5 py-3.5">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-[#D6F45B] mr-3" />
            <p className="text-sm text-white/80">
              Utiliza el botón <strong className="text-white">&quot;Revisar / IA&quot;</strong> en cada producto para generar su contenido uno por uno. Solo los productos con el check verde se exportarán.
            </p>
          </div>
        </div>
      )}

      {/* Flight Progress Bar */}
      {currentSession && products.length > 0 && (
        <FlightProgressBar
          session={currentSession}
          products={products}
          lastSavedAt={lastSavedAt}
          isSaving={isSaving}
          onDownloadPartial={handleDownloadPartial}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Zona Archivo Maestro */}
        <Card className={cn(
          "transition-all duration-200",
          masterData ? "ring-2 ring-[#D6F45B]/50" : ""
        )}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
               <FileSpreadsheet className="h-5 w-5" /> 
               {masterData ? "Archivo Maestro Cargado" : "Paso 1: CSV Maestro"}
            </CardTitle>
            <CardDescription>
              {masterData
                 ? `${masterData.totalProductsCount} productos rastreados en la tienda.`
                 : outputMode !== "csv_only"
                 ? "Opcional en modo Shopify Live. Solo necesario para exportar CSV."
                 : "Sube el último 'products_export.csv' para aprender cabeceras y códigos."}
            </CardDescription>
          </CardHeader>
          <CardContent>
             <FileDropzone 
                onFileSelect={handleMasterFile} 
                accept=".csv"
                label={masterData ? "Actualizar Maestro" : "Arrastra el CSV Maestro"}
                description="Requerido para cabeceras y filtro de duplicados"
             />
          </CardContent>
        </Card>

        {/* Zona Nuevos Productos — CSV or Manual */}
        <Card className={cn(
          "transition-all duration-200",
          !masterData && outputMode === "csv_only" ? "opacity-50 pointer-events-none" : ""
        )}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
               <UploadCloud className="h-5 w-5" />
               {outputMode === "csv_only" ? "Paso 2: Nuevos Productos" : "Nuevos Productos"}
            </CardTitle>
            <CardDescription>
              Añade productos desde un archivo CSV o insértalos manualmente.
            </CardDescription>
            {/* Segmented Control */}
            {(masterData || outputMode !== "csv_only") && (
              <div className="flex bg-[#F0F0F0] rounded-lg p-1 mt-3">
                <button
                  onClick={() => setStep2Mode("csv")}
                  className={cn(
                    "flex-1 text-sm font-medium py-2 px-4 rounded-md transition-all duration-200",
                    step2Mode === "csv"
                      ? "bg-[#D6F45B] text-[#0F0F0F] shadow-sm"
                      : "text-[#8C8C8C] hover:text-[#1A1A1A]"
                  )}
                >
                  Subir CSV
                </button>
                <button
                  onClick={() => setStep2Mode("manual")}
                  className={cn(
                    "flex-1 text-sm font-medium py-2 px-4 rounded-md transition-all duration-200",
                    step2Mode === "manual"
                      ? "bg-[#D6F45B] text-[#0F0F0F] shadow-sm"
                      : "text-[#8C8C8C] hover:text-[#1A1A1A]"
                  )}
                >
                  Manual
                </button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {step2Mode === "csv" ? (
              <FileDropzone
                onFileSelect={handleNewFile}
                accept=".csv"
                disabled={!masterData && outputMode === "csv_only"}
                label="Arrastra Nuevos Productos"
              />
            ) : (
              (masterData || outputMode !== "csv_only") && (
                <ManualProductForm
                  masterData={masterData}
                  existingProducts={products}
                  onAddProduct={handleManualAdd}
                />
              )
            )}
          </CardContent>
        </Card>
      </div>

      {/* Acciones y Progreso */}
      {products.length > 0 && (
        <Card>
            <CardHeader className="pb-3 border-b border-[#E5E7EB] bg-[#F5F6F7]/50 rounded-t-2xl">
              <div className="flex justify-between items-center">
                 <CardTitle className="text-lg">Zona de Preparación ({products.length} productos cargados)</CardTitle>
                 <div className="text-xs text-[#0F0F0F] bg-[#D6F45B] px-3 py-1 rounded-lg font-medium">
                    Modo Revisión Asistida Activo
                 </div>
              </div>
            </CardHeader>
           <CardContent>
              <ProductsTable 
                 products={products} 
                 masterData={masterData}
                 onUpdateProduct={handleUpdateProduct}
                 onRemoveProduct={handleRemoveProduct}
              />
           </CardContent>
        </Card>
      )}
      
      {/* Dialogo de Duplicados */}
      <Dialog open={showSkippedDialog} onOpenChange={setShowSkippedDialog}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
               <AlertTriangle className="h-5 w-5" /> 
               Reporte de Duplicados ({skippedProducts.length})
            </DialogTitle>
            <DialogDescription>
              Los siguientes productos ya existen en el Maestro y <b>NO</b> se importarán.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-[#E5E7EB] max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                   <TableHead>Nombre</TableHead>
                   <TableHead>Código de Barras</TableHead>
                   <TableHead>Razón</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {skippedProducts.map((p, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="font-mono text-xs">{p.barcode}</TableCell>
                    <TableCell className="text-xs text-[#8C8C8C]">{p.reason || "Duplicado"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end">
             <Button onClick={() => setShowSkippedDialog(false)}>Entendido</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialogo de Éxito */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="max-w-md rounded-2xl border-[#E5E7EB] text-center p-8 sm:p-10 [&>button]:hidden">
          <div className="flex flex-col items-center justify-center space-y-5">
             <div className="h-20 w-20 rounded-full bg-[#D6F45B] flex items-center justify-center mb-2 shadow-lg shadow-[#D6F45B]/20">
                <CheckCircle2 className="h-10 w-10 text-[#0F0F0F]" />
             </div>
             <DialogTitle className="text-3xl font-bold tracking-tight text-[#0F0F0F]">
               ¡Éxito!
             </DialogTitle>
             <DialogDescription className="text-[#8C8C8C] text-lg font-medium max-w-[280px] mx-auto">
               Se añadieron <strong className="text-[#0F0F0F] font-bold">{successCount}</strong> productos nuevos correctamente.
             </DialogDescription>
             <Button
               className="mt-6 w-full rounded-xl bg-[#0F0F0F] text-[#D6F45B] hover:bg-[#1A1A1A] py-5 text-base font-semibold shadow-sm"
               onClick={() => setShowSuccessDialog(false)}
             >
               Continuar
             </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Session Recovery Dialog (El Avión) */}
      <SessionRecoveryDialog
        open={showRecoveryDialog}
        onOpenChange={setShowRecoveryDialog}
        session={currentSession}
        products={recoveryProducts}
        onRestore={handleRestore}
        onAbandon={handleAbandonSession}
        onDownloadPartial={handleDownloadPartial}
      />

      {/* Shopify Publish Dialog (Cycle 2) */}
      <ShopifyPublishDialog
        open={showPublishDialog}
        onOpenChange={setShowPublishDialog}
        products={products.filter(p => p.status === "complete" && p.isChecked)}
        onPublishComplete={handlePublishComplete}
      />
    </main>
  )
}

"use client"

export const dynamic = "force-dynamic";

import * as React from "react"
import { FileDropzone } from "@/components/file-dropzone"
import { ProductsTable } from "@/components/products-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MasterData, parseMasterCSV } from "@/lib/csv-parser"
import { ProcessedProduct, processNewProducts, SkippedProduct } from "@/lib/product-processor"
import { generateCSV } from "@/lib/csv-exporter"
import { Download, Play, Trash2, FileSpreadsheet, UploadCloud, AlertTriangle } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { BackupService } from "@/lib/backup-service"
import { SettingsDialog } from "@/components/settings-dialog"

// Helper for generating UUIDs in non-secure contexts
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default function Dashboard() {
  const [masterData, setMasterData] = React.useState<MasterData | null>(null)
  const [products, setProducts] = React.useState<ProcessedProduct[]>([])
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  
  // Duplicate Dialog State
  const [skippedProducts, setSkippedProducts] = React.useState<SkippedProduct[]>([])
  const [showSkippedDialog, setShowSkippedDialog] = React.useState(false)

  // Backup State
  const [showRestoreDialog, setShowRestoreDialog] = React.useState(false)
  const [backupProducts, setBackupProducts] = React.useState<ProcessedProduct[]>([])
  const [sessionId, setSessionId] = React.useState<string>("")

  // Init Session & Check Backup
  React.useEffect(() => {
    // 1. Get or create Session ID
    let sid = localStorage.getItem("shopify_importer_device_id")
    if (!sid) {
      sid = generateUUID()
      localStorage.setItem("shopify_importer_device_id", sid)
    }
    setSessionId(sid)

    // 2. Check for backups
    const checkBackup = async () => {
       if (!sid) return
       const backup = await BackupService.getBackup(sid)
       if (backup && backup.products && Array.isArray(backup.products) && backup.products.length > 0) {
          setBackupProducts(backup.products)
          setShowRestoreDialog(true)
       }
    }
    checkBackup()

    // 3. Load MasterData from LocalStorage
    const storedMaster = localStorage.getItem("shopify_importer_master_data")
    if (storedMaster) {
      try {
        const parsed = JSON.parse(storedMaster)
        // Rehydrate Set
        if (parsed.existingBarcodes) {
           parsed.existingBarcodes = new Set(parsed.existingBarcodes)
        }
        setMasterData(parsed)
      } catch (e) {
        console.error("Error loading master data from local storage", e)
      }
    }
  }, [])

  // Auto-Save Effect (Debounced)
  React.useEffect(() => {
    if (!sessionId || products.length === 0) return

    const timeoutId = setTimeout(() => {
       console.log("Auto-saving to Supabase...", products.length)
       BackupService.saveBackup(sessionId, products)
    }, 2000) // 2s debounce

    return () => clearTimeout(timeoutId)
  }, [products, sessionId])

  const handleRestore = () => {
    setProducts(backupProducts)
    setShowRestoreDialog(false)
    alert("✅ Sesión restaurada con éxito.")
  }

  const handleDiscardBackup = () => {
    setShowRestoreDialog(false)
  }

  // 1. Manejar Archivo Maestro
  const handleMasterFile = async (file: File) => {
    try {
      const data = await parseMasterCSV(file)
      setMasterData(data)
      
      // Persist to LocalStorage (Serialize Set to Array)
      const toStore = {
         ...data,
         existingBarcodes: Array.from(data.existingBarcodes)
      }
      localStorage.setItem("shopify_importer_master_data", JSON.stringify(toStore))

    } catch (error) {
      console.error("Error al procesar CSV Maestro:", error)
      alert("Error al procesar CSV Maestro. Revisa la consola.")
    }
  }

  // 2. Manejar Archivo de Nuevos Productos
  const handleNewFile = async (file: File) => {
    if (!masterData) {
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
        // If we have skipped items, it means headers were likely OK, just all duplicates.
        // If NO skipped items and NO new products, THEN it's a header issue or empty file.
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
          setProducts(prev => [...prev, ...trulyNewProducts]);
          if (skipped.length === 0) {
            alert(`✅ ¡Éxito! Se añadieron ${trulyNewProducts.length} productos nuevos.`);
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

  // 4. Actualizar Producto (Edición Manual)
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

  // 5. Exportar
  const handleExport = () => {
    if (!masterData) return
    const readyProducts = products.filter(p => p.status === "complete" && p.isChecked)
    if (readyProducts.length === 0) {
      alert("No hay productos SELECCIONADOS y terminados para exportar.")
      return
    }
    const csvArgs = generateCSV(readyProducts, masterData.headers)
    
    const blob = new Blob([csvArgs], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `shopify_import_${readyProducts.length}_items.csv`
    link.click()
  }

  return (
    <main className="container mx-auto p-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
           <h1 className="text-3xl font-bold tracking-tight">Arquitecto de Importación Shopify</h1>
           <p className="text-muted-foreground">Filtro de duplicados, precios UE y enriquecimiento con IA.</p>
        </div>
        <div className="flex gap-2 items-center">
            <SettingsDialog />
            <Button 
               className="cursor-pointer hover:bg-destructive/90"
               variant="outline" 
               onClick={() => {
                  if (confirm("¿Estás seguro? Esto borrará todos los productos y el archivo maestro.")) {
                     setProducts([])
                     setMasterData(null)
                     localStorage.removeItem("shopify_importer_master_data")
                  }
               }} 
               disabled={products.length === 0 && !masterData}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Limpiar Todo
            </Button>
            <Button 
              className={cn("cursor-pointer transition-all active:scale-95", "hover:bg-primary/90")}
              onClick={handleExport} 
              disabled={!products.some(p => p.status === "complete" && p.isChecked) || !masterData}
              variant="default"
            >
              <Download className="mr-2 h-4 w-4" /> 
              Exportar {products.filter(p => p.status === "complete" && p.isChecked).length} Seleccionados
            </Button>
        </div>
      </div>

      {products.some(p => p.status === "pending" || p.status === "error") && (
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded shadow-sm">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-blue-500 mr-3" />
            <p className="text-sm text-blue-700">
              Utiliza el botón <strong>&quot;Revisar / IA&quot;</strong> en cada producto para generar su contenido uno por uno. Solo los productos con el check verde se exportarán.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Zona Archivo Maestro */}
        <Card className={cn(
          "transition-all duration-300 hover:shadow-lg",
          masterData ? "border-green-500 bg-green-50/10 shadow-sm" : "hover:border-primary/30"
        )}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
               <FileSpreadsheet className="h-5 w-5" /> 
               {masterData ? "Archivo Maestro Cargado" : "Paso 1: CSV Maestro"}
            </CardTitle>
            <CardDescription>
              {masterData 
                 ? `${masterData.totalProductsCount} productos rastreados en la tienda.` 
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

        {/* Zona Nuevos Productos */}
        <Card className={cn(
          "transition-all duration-300 hover:shadow-lg", 
          !masterData ? "opacity-50 cursor-not-allowed" : "hover:border-primary/30"
        )}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
               <UploadCloud className="h-5 w-5" />
               Paso 2: Nuevos Productos
            </CardTitle>
            <CardDescription>
              Sube CSV simple (Nombre, Marca, Precio (EUR), Tamaño, Código de barras).
            </CardDescription>
          </CardHeader>
          <CardContent>
             <FileDropzone 
                onFileSelect={handleNewFile}
                accept=".csv"
                disabled={!masterData}
                label="Arrastra Nuevos Productos"
             />
          </CardContent>
        </Card>
      </div>

      {/* Acciones y Progreso */}
      {products.length > 0 && (
        <Card>
            <CardHeader className="pb-3 border-b bg-muted/20">
              <div className="flex justify-between items-center">
                 <CardTitle className="text-lg">Zona de Preparación ({products.length} productos cargados)</CardTitle>
                 <div className="text-xs text-muted-foreground bg-white px-3 py-1 rounded-full border shadow-sm">
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
               <AlertTriangle className="h-5 w-5" /> 
               Reporte de Duplicados ({skippedProducts.length})
            </DialogTitle>
            <DialogDescription>
              Los siguientes productos ya existen en el Maestro y <b>NO</b> se importarán.
            </DialogDescription>
          </DialogHeader>
          <div className="border rounded-md max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                   <TableHead>Nombre</TableHead>
                   <TableHead>Código de Barras</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {skippedProducts.map((p, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="font-mono text-xs">{p.barcode}</TableCell>
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

       {/* Dialogo de Restauración de Backup */}
      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
               <UploadCloud className="h-5 w-5 text-blue-600" />
               Sesión Encontrada
            </DialogTitle>
            <DialogDescription>
               Encontramos una copia de seguridad en la nube con <strong>{backupProducts.length} productos</strong>.
               <br/>
               ¿Quieres restaurar tu trabajo anterior?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
             <Button variant="outline" onClick={handleDiscardBackup}>Iniciar de Cero</Button>
             <Button onClick={handleRestore} className="bg-blue-600 hover:bg-blue-700 text-white">
               <Download className="mr-2 h-4 w-4" /> Restaurar Sesión
             </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}

"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Plus, AlertTriangle } from "lucide-react"
import { ProcessedProduct, calculateUnitPrice } from "@/lib/product-processor"
import { MasterData } from "@/lib/csv-parser"
import { sanitizeBarcode } from "@/lib/barcode-utils"
import { generateUUID } from "@/lib/utils"

interface ManualProductFormProps {
  masterData: MasterData
  existingProducts: ProcessedProduct[]
  onAddProduct: (product: ProcessedProduct) => void
}

export function ManualProductForm({ masterData, existingProducts, onAddProduct }: ManualProductFormProps) {
  const nameRef = React.useRef<HTMLInputElement>(null)
  const [nombre, setNombre] = React.useState("")
  const [marca, setMarca] = React.useState("")
  const [precio, setPrecio] = React.useState("")
  const [tamano, setTamano] = React.useState("")
  const [barcode, setBarcode] = React.useState("")

  const [barcodeError, setBarcodeError] = React.useState("")
  const [titleWarning, setTitleWarning] = React.useState("")

  const canAdd = nombre.trim() !== "" && marca.trim() !== "" && !barcodeError

  // Validate barcode on change
  React.useEffect(() => {
    setBarcodeError("")
    if (!barcode.trim()) return

    const sanitized = sanitizeBarcode(barcode.trim())
    if (!sanitized) return

    const inMaster = masterData.existingBarcodes.has(sanitized)
    const inProducts = existingProducts.some(p => p.barcode === sanitized)

    if (inMaster || inProducts) {
      setBarcodeError("Este código de barras ya existe")
    }
  }, [barcode, masterData, existingProducts])

  // Validate title on change
  React.useEffect(() => {
    setTitleWarning("")
    const normalized = nombre.trim().toLowerCase()
    if (!normalized) return

    const inMaster = masterData.existingTitles.has(normalized)
    const inProducts = existingProducts.some(p => p.title.trim().toLowerCase() === normalized)

    if (inMaster || inProducts) {
      setTitleWarning("Ya existe un producto con este nombre")
    }
  }, [nombre, masterData, existingProducts])

  const handleAdd = () => {
    if (!canAdd) return

    const sanitizedBarcode = barcode.trim() ? sanitizeBarcode(barcode.trim()) : ""
    const id = sanitizedBarcode || generateUUID()
    const unitPriceCalc = calculateUnitPrice(tamano || "")

    const product: ProcessedProduct = {
      id,
      title: nombre.trim(),
      vendor: marca.trim(),
      price: precio.trim(),
      barcode: sanitizedBarcode,
      size: tamano.trim(),

      generatedTitle: nombre.trim(),
      bodyHtml: "",
      tags: "",
      images: [],
      seoTitle: "",
      seoDescription: "",

      metafields: {
        acorde: "",
        genero: "",
        notas_salida: "",
        ocasion: "",
        estacion: "",
        aroma: "",
        sexo_objetivo: "",
      },

      unitPrice: unitPriceCalc,
      isDuplicate: false,
      isChecked: true,
      status: "pending",
    }

    onAddProduct(product)

    // Reset form
    setNombre("")
    setMarca("")
    setPrecio("")
    setTamano("")
    setBarcode("")
    setBarcodeError("")
    setTitleWarning("")

    // Focus back to nombre
    nameRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && canAdd) {
      e.preventDefault()
      handleAdd()
    }
  }

  return (
    <div className="space-y-4" onKeyDown={handleKeyDown}>
      {/* Row 1: Nombre + Marca */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="manual-nombre" className="text-xs font-medium text-[#8C8C8C] uppercase tracking-wider">
            Nombre *
          </Label>
          <Input
            ref={nameRef}
            id="manual-nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Sauvage Eau de Parfum"
            autoComplete="off"
          />
          {titleWarning && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {titleWarning}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="manual-marca" className="text-xs font-medium text-[#8C8C8C] uppercase tracking-wider">
            Marca *
          </Label>
          <Input
            id="manual-marca"
            value={marca}
            onChange={(e) => setMarca(e.target.value)}
            placeholder="Ej: Dior"
            autoComplete="off"
          />
        </div>
      </div>

      {/* Row 2: Precio + Tamaño + Barcode */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="manual-precio" className="text-xs font-medium text-[#8C8C8C] uppercase tracking-wider">
            Precio (EUR)
          </Label>
          <Input
            id="manual-precio"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            placeholder="39.90"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="manual-tamano" className="text-xs font-medium text-[#8C8C8C] uppercase tracking-wider">
            Tamaño
          </Label>
          <Input
            id="manual-tamano"
            value={tamano}
            onChange={(e) => setTamano(e.target.value)}
            placeholder="100ml"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="manual-barcode" className="text-xs font-medium text-[#8C8C8C] uppercase tracking-wider">
            Código de barras
          </Label>
          <Input
            id="manual-barcode"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="3348901234567"
            autoComplete="off"
            className={barcodeError ? "border-red-400 focus:border-red-400" : ""}
          />
          {barcodeError && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {barcodeError}
            </p>
          )}
        </div>
      </div>

      {/* Add Button */}
      <Button
        onClick={handleAdd}
        disabled={!canAdd}
        className="w-full sm:w-auto"
      >
        <Plus className="h-4 w-4 mr-2" />
        Agregar a la tabla
      </Button>
    </div>
  )
}

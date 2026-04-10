"use client"

export const dynamic = "force-dynamic";

import Link from "next/link"
import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ShieldCheck, Activity, BrainCircuit, ArrowRight, Play, Search, ArrowLeft, Check, X, Eye, ChevronLeft, ChevronRight, Package } from "lucide-react"
import { useUserSettings } from "@/hooks/use-user-settings"
import { AuditableProduct } from "@/lib/shopify-auditor"

// ============================================================================
// Types
// ============================================================================

type AuditStatus = "pending" | "generating" | "generated" | "approved" | "skipped"

interface AuditItem {
  product: AuditableProduct
  status: AuditStatus
  proposedData: ProposedData | null
}

interface ProposedData {
  title: string
  bodyHtml: string
  seoTitle: string
  seoDescription: string
  tags: string[]
  // Raw editable fields
  headline: string
  hook: string
  notas_salida: string
  notas_corazon: string
  notas_fondo: string
  caracter: string
  ideal_para: string
  sensacion: string
}

function buildProductHTML(data: { headline: string; hook: string; notas_salida: string; notas_corazon: string; notas_fondo: string; caracter: string; ideal_para: string; sensacion: string }): string {
  return `<h2>${data.headline}</h2>
<p>${data.hook}</p>
<h3>Notas Olfativas</h3>
<p><strong>Salida:</strong> ${data.notas_salida}</p>
<p><strong>Corazón:</strong> ${data.notas_corazon}</p>
<p><strong>Fondo:</strong> ${data.notas_fondo}</p>
<h3>¿Por qué elegirlo?</h3>
<p><strong>Carácter:</strong> ${data.caracter}<br/><strong>Ideal para:</strong> ${data.ideal_para}<br/><strong>Sensación:</strong> ${data.sensacion}</p>`
}

type ViewMode = "setup" | "batch_overview" | "product_review"
type LoadMode = "batch" | "search"

// ============================================================================
// Helper: Extract short ID from Shopify GID
// ============================================================================
function shortId(gid: string): string {
  const parts = gid.split("/")
  return parts[parts.length - 1] || gid
}

// ============================================================================
// Main Component
// ============================================================================
export default function AuditorPage() {
  const { settings } = useUserSettings()

  // State
  const [viewMode, setViewMode] = React.useState<ViewMode>("setup")
  const [loadMode, setLoadMode] = React.useState<LoadMode>("batch")
  const [batchSize, setBatchSize] = React.useState(5)
  const [isLoading, setIsLoading] = React.useState(false)
  const [auditItems, setAuditItems] = React.useState<AuditItem[]>([])
  const [currentIndex, setCurrentIndex] = React.useState(0)
  const [isGenerating, setIsGenerating] = React.useState(false)

  // Search state
  const [searchQuery, setSearchQuery] = React.useState("")
  const [searchResults, setSearchResults] = React.useState<AuditableProduct[]>([])
  const [isSearching, setIsSearching] = React.useState(false)
  const [selectedProducts, setSelectedProducts] = React.useState<AuditableProduct[]>([])

  const shopifyConfig = {
    shopDomain: settings.shopify_domain,
    accessToken: settings.shopify_access_token,
    apiVersion: settings.shopify_api_version || "2025-01",
  }

  const isShopifyConnected = Boolean(settings.shopify_domain && settings.shopify_access_token)

  // ─── Load Batch ────────────────────────────────────────────────
  const loadBatch = async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/shopify/audit/get-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...shopifyConfig, limit: batchSize }),
      })
      const data = await res.json()
      if (data.products?.length > 0) {
        const items: AuditItem[] = data.products.map((p: AuditableProduct) => ({
          product: p,
          status: "pending" as AuditStatus,
          proposedData: null,
        }))
        setAuditItems(items)
        setCurrentIndex(0)
        setViewMode("batch_overview")
      } else {
        alert("No se encontraron productos para auditar.")
      }
    } catch (e) {
      alert("Error al cargar productos de Shopify.")
    } finally {
      setIsLoading(false)
    }
  }

  // ─── Search Products ──────────────────────────────────────────
  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setIsSearching(true)
    try {
      const res = await fetch("/api/shopify/audit/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...shopifyConfig, query: searchQuery }),
      })
      const data = await res.json()
      setSearchResults(data.products || [])
    } catch (e) {
      alert("Error en la búsqueda.")
    } finally {
      setIsSearching(false)
    }
  }

  const toggleSelectProduct = (product: AuditableProduct) => {
    setSelectedProducts(prev => {
      const exists = prev.find(p => p.id === product.id)
      if (exists) return prev.filter(p => p.id !== product.id)
      return [...prev, product]
    })
  }

  const loadSelectedProducts = () => {
    if (selectedProducts.length === 0) return
    const items: AuditItem[] = selectedProducts.map(p => ({
      product: p,
      status: "pending" as AuditStatus,
      proposedData: null,
    }))
    setAuditItems(items)
    setCurrentIndex(0)
    setSelectedProducts([])
    setSearchResults([])
    setSearchQuery("")
    setViewMode("batch_overview")
  }

  // ─── Generate Proposal for a Product ──────────────────────────
  const generateProposal = async (index: number) => {
    const item = auditItems[index]
    if (!item) return

    setIsGenerating(true)
    setCurrentIndex(index)

    // Update status
    setAuditItems(prev => prev.map((it, i) =>
      i === index ? { ...it, status: "generating" } : it
    ))

    const product = item.product
    const sizeMatch = product.title.match(/(\d+)\s*(ml|oz|g)/i)
    const detectedSize = sizeMatch ? sizeMatch[0] : ""

    try {
      const aiProvider = settings.ai_provider || "gemini"
      const aiModel = aiProvider === "openai"
        ? (settings.ai_openai_model || "gpt-4o-mini")
        : (settings.ai_gemini_model || "gemini-2.5-flash")

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: aiProvider,
          modelVersion: aiModel,
          apiKey: settings.ai_api_key,
          fragellaApiKey: settings.fragella_api_key,
          product: {
            Nombre: product.title,
            Marca: product.vendor,
            Tamaño: detectedSize
          },
          htmlTemplate: product.bodyHtml
        })
      })

      const aiResult = await res.json()
      if (aiResult.error) {
        alert("Error de IA: " + aiResult.error)
        setAuditItems(prev => prev.map((it, i) =>
          i === index ? { ...it, status: "pending" } : it
        ))
      } else {
        setAuditItems(prev => prev.map((it, i) =>
          i === index ? {
            ...it,
            status: "generated",
            proposedData: {
              title: aiResult.title,
              bodyHtml: aiResult.body_html,
              seoTitle: aiResult.seo_title,
              seoDescription: aiResult.seo_description,
              tags: aiResult.tags ? aiResult.tags.split(",").map((s: string) => s.trim()) : [],
              headline: aiResult.headline || aiResult.title,
              hook: aiResult.hook || "",
              notas_salida: aiResult.notas_salida || "Consultar en Fragrantica",
              notas_corazon: aiResult.notas_corazon || "Consultar en Fragrantica",
              notas_fondo: aiResult.notas_fondo || "Consultar en Fragrantica",
              caracter: aiResult.caracter || "",
              ideal_para: aiResult.ideal_para || "",
              sensacion: aiResult.sensacion || "",
            }
          } : it
        ))
      }
    } catch (e) {
      alert("Error de red al contactar la IA.")
      setAuditItems(prev => prev.map((it, i) =>
        i === index ? { ...it, status: "pending" } : it
      ))
    } finally {
      setIsGenerating(false)
    }
  }

  // ─── Generate All Pending ─────────────────────────────────────
  const generateAll = async () => {
    for (let i = 0; i < auditItems.length; i++) {
      if (auditItems[i].status === "pending") {
        await generateProposal(i)
      }
    }
  }

  // ─── Approve / Skip ───────────────────────────────────────────
  const approveItem = (index: number) => {
    setAuditItems(prev => prev.map((it, i) =>
      i === index ? { ...it, status: "approved" } : it
    ))
  }

  const skipItem = (index: number) => {
    setAuditItems(prev => prev.map((it, i) =>
      i === index ? { ...it, status: "skipped" } : it
    ))
  }

  // ─── Apply Approved to Shopify ────────────────────────────────
  // ─── Update a single field in proposed data & rebuild HTML ─────
  const updateProposedField = (index: number, field: string, value: string) => {
    setAuditItems(prev => prev.map((it, i) => {
      if (i !== index || !it.proposedData) return it
      const updated = { ...it.proposedData, [field]: value }
      updated.bodyHtml = buildProductHTML(updated)
      return { ...it, proposedData: updated }
    }))
  }

  // ─── Apply Approved to Shopify ────────────────────────────────
  const applyApproved = async () => {
    const approved = auditItems.filter(it => it.status === "approved" && it.proposedData)
    if (approved.length === 0) {
      alert("No hay productos aprobados para aplicar.")
      return
    }

    setIsLoading(true)
    let successCount = 0
    let errorCount = 0

    for (const item of approved) {
      try {
        const res = await fetch("/api/shopify/audit/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...shopifyConfig,
            productId: item.product.id,
            updateData: {
              title: item.proposedData!.title,
              bodyHtml: item.proposedData!.bodyHtml,
              seoTitle: item.proposedData!.seoTitle,
              seoDescription: item.proposedData!.seoDescription,
              tags: item.proposedData!.tags,
            }
          }),
        })
        const result = await res.json()
        if (result.success) {
          successCount++
        } else {
          errorCount++
        }
      } catch {
        errorCount++
      }
    }

    alert(`Resultados: ${successCount} aplicados, ${errorCount} errores.`)
    setIsLoading(false)
  }

  // ─── Stats ────────────────────────────────────────────────────
  const stats = {
    total: auditItems.length,
    pending: auditItems.filter(i => i.status === "pending").length,
    generating: auditItems.filter(i => i.status === "generating").length,
    generated: auditItems.filter(i => i.status === "generated").length,
    approved: auditItems.filter(i => i.status === "approved").length,
    skipped: auditItems.filter(i => i.status === "skipped").length,
  }

  const currentItem = auditItems[currentIndex] || null

  // ════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════

  return (
    <main className="max-w-[1400px] mx-auto px-6 py-8 space-y-6 min-h-screen">

      {/* Header */}
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1A1A1A] flex items-center gap-3">
            Auditor Inteligente v3
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#D6F45B] text-[#0F0F0F]">
              Dry-Run Mode
            </span>
          </h1>
          <p className="text-[#8C8C8C] mt-1">Analiza tu catálogo en vivo, corrige alucinaciones y sube los cambios aprobados.</p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-white border border-[#E5E7EB] text-[#1A1A1A] hover:-translate-y-0.5 transition-all no-underline shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al Importador
        </Link>
      </div>

      {/* ═══ SETUP VIEW ═══ */}
      {viewMode === "setup" && (
        <div className="space-y-6">
          {!isShopifyConnected && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <p className="text-red-700 font-medium">⚠️ Configura tu conexión a Shopify en Ajustes antes de usar el Auditor.</p>
              </CardContent>
            </Card>
          )}

          {/* Mode Selector */}
          <div className="flex bg-[#F0F0F0] rounded-lg p-1 max-w-md">
            <button
              onClick={() => setLoadMode("batch")}
              className={`flex-1 text-sm font-medium py-2.5 px-4 rounded-md transition-all duration-200 ${
                loadMode === "batch" ? "bg-[#D6F45B] text-[#0F0F0F] shadow-sm" : "text-[#8C8C8C] hover:text-[#1A1A1A]"
              }`}
            >
              <Package className="w-4 h-4 inline mr-2" />Lote Automático
            </button>
            <button
              onClick={() => setLoadMode("search")}
              className={`flex-1 text-sm font-medium py-2.5 px-4 rounded-md transition-all duration-200 ${
                loadMode === "search" ? "bg-[#D6F45B] text-[#0F0F0F] shadow-sm" : "text-[#8C8C8C] hover:text-[#1A1A1A]"
              }`}
            >
              <Search className="w-4 h-4 inline mr-2" />Búsqueda Selectiva
            </button>
          </div>

          {/* Batch Mode */}
          {loadMode === "batch" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" /> Cargar Lote de Productos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-[#6B7280] font-medium">Tamaño del lote</label>
                  <div className="flex gap-2 mt-2">
                    {[5, 10, 15, 20].map(n => (
                      <button
                        key={n}
                        onClick={() => setBatchSize(n)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          batchSize === n
                            ? "bg-[#0F0F0F] text-[#D6F45B] shadow"
                            : "bg-[#F0F0F0] text-[#6B7280] hover:bg-[#E5E7EB]"
                        }`}
                      >
                        {n} productos
                      </button>
                    ))}
                  </div>
                </div>
                <Button
                  onClick={loadBatch}
                  disabled={!isShopifyConnected || isLoading}
                  className="bg-[#0F0F0F] text-[#D6F45B] hover:bg-[#1A1A1A] rounded-xl px-6"
                >
                  <Play className="w-4 h-4 mr-2" />
                  {isLoading ? "Cargando..." : `Cargar ${batchSize} Productos`}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Search Mode */}
          {loadMode === "search" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" /> Buscar Productos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSearch()}
                    placeholder='Ej: "Yara", "Oud", "Lattafa"...'
                    className="flex-1 px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#D6F45B]"
                  />
                  <Button
                    onClick={handleSearch}
                    disabled={!isShopifyConnected || isSearching || !searchQuery.trim()}
                    className="bg-[#0F0F0F] text-[#D6F45B] hover:bg-[#1A1A1A] rounded-xl px-6"
                  >
                    {isSearching ? "Buscando..." : "Buscar"}
                  </Button>
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-[#6B7280]">{searchResults.length} resultados encontrados</p>
                      {selectedProducts.length > 0 && (
                        <Button
                          onClick={loadSelectedProducts}
                          className="bg-[#D6F45B] text-[#0F0F0F] hover:brightness-95 rounded-xl px-4 text-sm"
                        >
                          Auditar {selectedProducts.length} seleccionado{selectedProducts.length !== 1 ? "s" : ""}
                        </Button>
                      )}
                    </div>
                    <div className="border border-[#E5E7EB] rounded-xl overflow-hidden max-h-[400px] overflow-y-auto">
                      {searchResults.map(p => {
                        const isSelected = selectedProducts.some(sp => sp.id === p.id)
                        return (
                          <button
                            key={p.id}
                            onClick={() => toggleSelectProduct(p)}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all border-b border-[#F0F0F0] last:border-b-0 ${
                              isSelected ? "bg-[#D6F45B]/10" : "hover:bg-[#F5F6F7]"
                            }`}
                          >
                            {p.featuredImage && (
                              <img src={p.featuredImage} alt="" className="w-10 h-10 rounded-lg object-cover" />
                            )}
                            {!p.featuredImage && (
                              <div className="w-10 h-10 rounded-lg bg-[#F0F0F0] flex items-center justify-center">
                                <Package className="w-5 h-5 text-[#8C8C8C]" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[#1A1A1A] truncate">{p.title}</p>
                              <p className="text-xs text-[#8C8C8C]">{p.vendor} · €{p.variants[0]?.price || "0"} · ID: {shortId(p.id)}</p>
                            </div>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              isSelected ? "bg-[#D6F45B] border-[#D6F45B]" : "border-[#D1D5DB]"
                            }`}>
                              {isSelected && <Check className="w-3 h-3 text-[#0F0F0F]" />}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ═══ BATCH OVERVIEW VIEW ═══ */}
      {viewMode === "batch_overview" && (
        <div className="space-y-4">
          {/* Progress Bar */}
          <Card className="border-[#D6F45B]/30">
            <CardContent className="pt-5 pb-4">
              <div className="flex justify-between items-center mb-3">
                <div className="flex gap-4 text-sm">
                  <span className="text-[#8C8C8C]">Total: <strong className="text-[#1A1A1A]">{stats.total}</strong></span>
                  <span className="text-amber-600">Pendientes: <strong>{stats.pending}</strong></span>
                  <span className="text-blue-600">Generados: <strong>{stats.generated}</strong></span>
                  <span className="text-green-600">Aprobados: <strong>{stats.approved}</strong></span>
                  <span className="text-[#8C8C8C]">Ignorados: <strong>{stats.skipped}</strong></span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setViewMode("setup"); setAuditItems([]); }}
                    className="rounded-xl text-xs"
                  >
                    ← Nuevo lote
                  </Button>
                  <Button
                    size="sm"
                    onClick={generateAll}
                    disabled={isGenerating || stats.pending === 0}
                    className="bg-[#0F0F0F] text-[#D6F45B] hover:bg-[#1A1A1A] rounded-xl text-xs"
                  >
                    <BrainCircuit className="w-3.5 h-3.5 mr-1.5" />
                    {isGenerating ? "Generando..." : `Generar IA (${stats.pending})`}
                  </Button>
                  <Button
                    size="sm"
                    onClick={applyApproved}
                    disabled={isLoading || stats.approved === 0}
                    className="bg-green-600 text-white hover:bg-green-700 rounded-xl text-xs"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                    Aplicar {stats.approved} a Shopify
                  </Button>
                </div>
              </div>
              <div className="h-2 bg-[#F0F0F0] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#D6F45B] transition-all duration-500 rounded-full"
                  style={{ width: `${stats.total > 0 ? ((stats.approved + stats.skipped) / stats.total) * 100 : 0}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Products Table */}
          <Card>
            <CardContent className="pt-4 px-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] text-[#6B7280]">
                      <th className="text-left px-4 py-2.5 font-medium">#</th>
                      <th className="text-left px-4 py-2.5 font-medium">Producto</th>
                      <th className="text-left px-4 py-2.5 font-medium">Marca</th>
                      <th className="text-left px-4 py-2.5 font-medium">Precio</th>
                      <th className="text-left px-4 py-2.5 font-medium">Barcode</th>
                      <th className="text-left px-4 py-2.5 font-medium">ID</th>
                      <th className="text-left px-4 py-2.5 font-medium">Status</th>
                      <th className="text-left px-4 py-2.5 font-medium">Estado IA</th>
                      <th className="text-right px-4 py-2.5 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditItems.map((item, idx) => (
                      <tr
                        key={item.product.id}
                        className={`border-b border-[#F0F0F0] transition-colors ${
                          idx === currentIndex ? "bg-[#D6F45B]/5" : "hover:bg-[#F5F6F7]"
                        }`}
                      >
                        <td className="px-4 py-3 text-[#8C8C8C]">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {item.product.featuredImage ? (
                              <img src={item.product.featuredImage} alt="" className="w-8 h-8 rounded object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded bg-[#F0F0F0] flex items-center justify-center">
                                <Package className="w-4 h-4 text-[#8C8C8C]" />
                              </div>
                            )}
                            <span className="font-medium text-[#1A1A1A] max-w-[200px] truncate">{item.product.title}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#6B7280]">{item.product.vendor}</td>
                        <td className="px-4 py-3 font-mono text-[#1A1A1A]">€{item.product.variants[0]?.price || "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs text-[#8C8C8C]">{item.product.variants[0]?.barcode || "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs text-[#8C8C8C]">{shortId(item.product.id)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            item.product.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                          }`}>
                            {item.product.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={item.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex gap-1.5 justify-end">
                            {item.status === "pending" && (
                              <button
                                onClick={() => generateProposal(idx)}
                                disabled={isGenerating}
                                className="text-xs px-2.5 py-1 rounded-lg bg-[#0F0F0F] text-[#D6F45B] hover:bg-[#1A1A1A] transition-all font-medium disabled:opacity-50"
                              >
                                <BrainCircuit className="w-3 h-3 inline mr-1" />IA
                              </button>
                            )}
                            {(item.status === "generated" || item.status === "approved" || item.status === "skipped") && (
                              <button
                                onClick={() => { setCurrentIndex(idx); setViewMode("product_review"); }}
                                className="text-xs px-2.5 py-1 rounded-lg bg-[#F0F0F0] text-[#1A1A1A] hover:bg-[#E5E7EB] transition-all font-medium"
                              >
                                <Eye className="w-3 h-3 inline mr-1" />Ver
                              </button>
                            )}
                            {item.status === "generated" && (
                              <>
                                <button
                                  onClick={() => approveItem(idx)}
                                  className="text-xs px-2.5 py-1 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-all font-medium"
                                >
                                  <Check className="w-3 h-3 inline" />
                                </button>
                                <button
                                  onClick={() => skipItem(idx)}
                                  className="text-xs px-2.5 py-1 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-all font-medium"
                                >
                                  <X className="w-3 h-3 inline" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══ PRODUCT REVIEW VIEW ═══ */}
      {viewMode === "product_review" && currentItem && (
        <div className="space-y-4">
          {/* Navigation */}
          <div className="flex justify-between items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode("batch_overview")}
              className="rounded-xl"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Volver al Lote
            </Button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                disabled={currentIndex === 0}
                className="p-2 rounded-lg hover:bg-[#F0F0F0] disabled:opacity-30 transition-all"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm font-medium text-[#6B7280]">
                {currentIndex + 1} / {auditItems.length}
              </span>
              <button
                onClick={() => setCurrentIndex(Math.min(auditItems.length - 1, currentIndex + 1))}
                disabled={currentIndex === auditItems.length - 1}
                className="p-2 rounded-lg hover:bg-[#F0F0F0] disabled:opacity-30 transition-all"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <div className="flex gap-2">
              {currentItem.status === "pending" && (
                <Button
                  size="sm"
                  onClick={() => generateProposal(currentIndex)}
                  disabled={isGenerating}
                  className="bg-[#0F0F0F] text-[#D6F45B] hover:bg-[#1A1A1A] rounded-xl"
                >
                  <BrainCircuit className="w-4 h-4 mr-1.5" />
                  {isGenerating ? "Generando..." : "Generar con IA"}
                </Button>
              )}
              {(currentItem.status === "generated" || currentItem.status === "approved" || currentItem.status === "skipped") && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setAuditItems(prev => prev.map((it, i) =>
                        i === currentIndex ? { ...it, status: "pending", proposedData: null } : it
                      ))
                      // Auto-regenerar
                      setTimeout(() => generateProposal(currentIndex), 100)
                    }}
                    disabled={isGenerating}
                    className="rounded-xl border-amber-300 text-amber-700 hover:bg-amber-50"
                  >
                    <BrainCircuit className="w-4 h-4 mr-1.5" />
                    {isGenerating ? "Regenerando..." : "Regenerar IA"}
                  </Button>
                </>
              )}
              {currentItem.status === "generated" && (
                <>
                  <Button size="sm" onClick={() => approveItem(currentIndex)} className="bg-green-600 text-white hover:bg-green-700 rounded-xl">
                    <Check className="w-4 h-4 mr-1.5" /> Aprobar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => skipItem(currentIndex)} className="rounded-xl text-red-500 border-red-200 hover:bg-red-50">
                    <X className="w-4 h-4 mr-1.5" /> Ignorar
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Product Info Card */}
          <Card>
            <CardHeader className="pb-3 border-b border-[#E5E7EB]">
              <div className="flex items-start gap-4">
                {currentItem.product.featuredImage ? (
                  <img src={currentItem.product.featuredImage} alt="" className="w-16 h-16 rounded-xl object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-[#F0F0F0] flex items-center justify-center">
                    <Package className="w-8 h-8 text-[#8C8C8C]" />
                  </div>
                )}
                <div className="flex-1">
                  <CardTitle className="text-lg">{currentItem.product.title}</CardTitle>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-sm text-[#6B7280]">
                    <span><strong>Marca:</strong> {currentItem.product.vendor}</span>
                    <span><strong>Precio:</strong> €{currentItem.product.variants[0]?.price || "—"}</span>
                    <span><strong>Barcode:</strong> {currentItem.product.variants[0]?.barcode || "—"}</span>
                    <span><strong>Tipo:</strong> {currentItem.product.productType || "—"}</span>
                    <span><strong>Status:</strong> {currentItem.product.status}</span>
                    <span><strong>ID:</strong> {shortId(currentItem.product.id)}</span>
                  </div>
                  {currentItem.product.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {currentItem.product.tags.slice(0, 8).map(tag => (
                        <span key={tag} className="inline-flex px-2 py-0.5 rounded-full text-xs bg-[#F0F0F0] text-[#6B7280]">{tag}</span>
                      ))}
                      {currentItem.product.tags.length > 8 && (
                        <span className="text-xs text-[#8C8C8C]">+{currentItem.product.tags.length - 8} más</span>
                      )}
                    </div>
                  )}
                </div>
                <StatusBadge status={currentItem.status} />
              </div>
            </CardHeader>
          </Card>

          {/* Comparison: Original vs Proposed */}
          {currentItem.proposedData && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-sm text-[#8C8C8C] uppercase tracking-wider">Original</CardTitle>
                </CardHeader>
                <CardContent>
                  <h3 className="font-semibold text-[#1A1A1A] mb-2">{currentItem.product.title}</h3>
                  <div
                    className="prose prose-sm max-w-none text-[#6B7280]"
                    dangerouslySetInnerHTML={{ __html: currentItem.product.bodyHtml || "<p class='italic text-[#8C8C8C]'>Sin descripción</p>" }}
                  />
                </CardContent>
              </Card>

              <Card className="ring-2 ring-[#D6F45B]/40">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-sm text-[#D6F45B] uppercase tracking-wider flex items-center gap-1.5">
                    <BrainCircuit className="w-3.5 h-3.5" /> Propuesta IA (editable)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Headline & Hook */}
                  <div>
                    <label className="text-xs font-medium text-[#8C8C8C]">Headline</label>
                    <input
                      type="text"
                      value={currentItem.proposedData.headline}
                      onChange={e => updateProposedField(currentIndex, "headline", e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-[#D6F45B]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#8C8C8C]">Hook (gancho)</label>
                    <textarea
                      value={currentItem.proposedData.hook}
                      onChange={e => updateProposedField(currentIndex, "hook", e.target.value)}
                      rows={2}
                      className="w-full px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-[#D6F45B] resize-none"
                    />
                  </div>

                  {/* Notas Olfativas */}
                  <div className="border-t border-[#E5E7EB] pt-3">
                    <p className="text-xs font-semibold text-[#1A1A1A] mb-2">Notas Olfativas</p>
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs font-medium text-[#8C8C8C]">Salida</label>
                        <input
                          type="text"
                          value={currentItem.proposedData.notas_salida}
                          onChange={e => updateProposedField(currentIndex, "notas_salida", e.target.value)}
                          placeholder="Ej: Bergamota, Pimienta Rosa, Cardamomo"
                          className={`w-full px-3 py-1.5 rounded-lg border text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-[#D6F45B] ${
                            currentItem.proposedData.notas_salida.includes("Consultar") || currentItem.proposedData.notas_salida.includes("no disponible")
                              ? "border-amber-300 bg-amber-50"
                              : "border-[#E5E7EB]"
                          }`}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-[#8C8C8C]">Corazón</label>
                        <input
                          type="text"
                          value={currentItem.proposedData.notas_corazon}
                          onChange={e => updateProposedField(currentIndex, "notas_corazon", e.target.value)}
                          placeholder="Ej: Jazmín, Iris, Café"
                          className={`w-full px-3 py-1.5 rounded-lg border text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-[#D6F45B] ${
                            currentItem.proposedData.notas_corazon.includes("Consultar") || currentItem.proposedData.notas_corazon.includes("no disponible")
                              ? "border-amber-300 bg-amber-50"
                              : "border-[#E5E7EB]"
                          }`}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-[#8C8C8C]">Fondo</label>
                        <input
                          type="text"
                          value={currentItem.proposedData.notas_fondo}
                          onChange={e => updateProposedField(currentIndex, "notas_fondo", e.target.value)}
                          placeholder="Ej: Almizcle, Vainilla, Sándalo"
                          className={`w-full px-3 py-1.5 rounded-lg border text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-[#D6F45B] ${
                            currentItem.proposedData.notas_fondo.includes("Consultar") || currentItem.proposedData.notas_fondo.includes("no disponible")
                              ? "border-amber-300 bg-amber-50"
                              : "border-[#E5E7EB]"
                          }`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Por qué elegirlo */}
                  <div className="border-t border-[#E5E7EB] pt-3">
                    <p className="text-xs font-semibold text-[#1A1A1A] mb-2">¿Por qué elegirlo?</p>
                    <div className="grid grid-cols-1 gap-2">
                      <div>
                        <label className="text-xs font-medium text-[#8C8C8C]">Carácter</label>
                        <input
                          type="text"
                          value={currentItem.proposedData.caracter}
                          onChange={e => updateProposedField(currentIndex, "caracter", e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-[#D6F45B]"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-[#8C8C8C]">Ideal para</label>
                        <input
                          type="text"
                          value={currentItem.proposedData.ideal_para}
                          onChange={e => updateProposedField(currentIndex, "ideal_para", e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-[#D6F45B]"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-[#8C8C8C]">Sensación</label>
                        <input
                          type="text"
                          value={currentItem.proposedData.sensacion}
                          onChange={e => updateProposedField(currentIndex, "sensacion", e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-[#D6F45B]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* SEO & Tags */}
                  <div className="border-t border-[#E5E7EB] pt-3 space-y-1 text-xs text-[#8C8C8C]">
                    <p><strong>SEO Title:</strong> {currentItem.proposedData.seoTitle}</p>
                    <p><strong>SEO Description:</strong> {currentItem.proposedData.seoDescription}</p>
                    <p><strong>Tags:</strong> {currentItem.proposedData.tags.join(", ")}</p>
                  </div>

                  {/* Live Preview */}
                  <div className="border-t border-[#E5E7EB] pt-3">
                    <p className="text-xs font-semibold text-[#1A1A1A] mb-2">Vista previa</p>
                    <div
                      className="prose prose-sm max-w-none text-[#6B7280] bg-[#FAFAFA] p-3 rounded-lg border border-[#E5E7EB]"
                      dangerouslySetInnerHTML={{ __html: currentItem.proposedData.bodyHtml }}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Generating State */}
          {currentItem.status === "generating" && (
            <Card className="border-[#D6F45B]/30">
              <CardContent className="py-12 text-center">
                <BrainCircuit className="w-8 h-8 text-[#D6F45B] mx-auto animate-pulse mb-3" />
                <p className="text-sm text-[#6B7280]">Buscando notas en Fragrantica y generando propuesta...</p>
              </CardContent>
            </Card>
          )}

          {/* Pending State */}
          {currentItem.status === "pending" && (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-sm text-[#8C8C8C]">Haz click en &quot;Generar con IA&quot; para crear una propuesta de mejora.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </main>
  )
}

// ============================================================================
// StatusBadge Component
// ============================================================================
function StatusBadge({ status }: { status: AuditStatus }) {
  const config = {
    pending: { label: "Pendiente", bg: "bg-gray-100", text: "text-gray-600" },
    generating: { label: "Generando...", bg: "bg-amber-100", text: "text-amber-700" },
    generated: { label: "Generado", bg: "bg-blue-100", text: "text-blue-700" },
    approved: { label: "Aprobado", bg: "bg-green-100", text: "text-green-700" },
    skipped: { label: "Ignorado", bg: "bg-red-50", text: "text-red-500" },
  }
  const c = config[status]
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  )
}

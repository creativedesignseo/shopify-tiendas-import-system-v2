"use client"

export const dynamic = "force-dynamic";

import Link from "next/link"
import versionData from "@/data/version.json"
import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ShieldCheck, Activity, BrainCircuit, CloudUpload, ArrowRight, Play, ServerCrash, Store } from "lucide-react"
import { useUserSettings } from "@/hooks/use-user-settings"
import { AuditableProduct } from "@/lib/shopify-auditor"

// Subcomponente de Comparativa
const ProductDiff = ({ original, proposed, isApproving, onApprove, onSkip }: any) => {
  return (
    <div className="bg-[#0F0F0F] text-white rounded-xl p-6 shadow-2xl space-y-6">
      <div className="flex justify-between items-center border-b border-white/10 pb-4">
        <h3 className="text-xl font-bold tracking-tight text-[#D6F45B]">{original.title}</h3>
        <span className="text-xs bg-white/10 px-3 py-1 rounded-full">{original.vendor}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
        {/* LINEA SEPARADORA */}
        <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-white/0 via-white/10 to-white/0 -translate-x-1/2" />
        
        {/* LADO VIEJO */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-rose-400 font-semibold mb-2">
            <ServerCrash className="h-4 w-4" /> Versión Actual (Shopify)
          </div>
          <div>
            <span className="text-xs text-white/40 uppercase tracking-wider block mb-1">Título</span>
            <p className="text-sm font-light text-white/80 border border-rose-500/20 bg-rose-500/5 p-3 rounded-lg opacity-80 line-through">
              {original.title}
            </p>
          </div>
          <div>
            <span className="text-xs text-white/40 uppercase tracking-wider block mb-1">Cuerpo (HTML)</span>
            <div className="text-sm font-light text-white/70 border border-white/10 bg-white/5 p-4 rounded-lg h-48 overflow-y-auto" dangerouslySetInnerHTML={{__html: original.bodyHtml || "Sin descripción"}} />
          </div>
        </div>

        {/* LADO NUEVO */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-[#D6F45B] font-semibold mb-2">
            <BrainCircuit className="h-4 w-4" /> Nueva Versión (IA Premium + Grounding)
          </div>
          <div>
             <span className="text-xs text-white/40 uppercase tracking-wider block mb-1">Nuevo Título</span>
             <p className="text-sm font-medium text-white border border-[#D6F45B]/30 bg-[#D6F45B]/10 p-3 rounded-lg shadow-inner">
               {proposed.title}
             </p>
          </div>
          <div>
            <span className="text-xs text-white/40 uppercase tracking-wider block mb-1">Nuevo Cuerpo (HTML)</span>
            <div className="text-sm text-white border border-[#D6F45B]/20 bg-[#D6F45B]/5 p-4 rounded-lg h-48 overflow-y-auto" dangerouslySetInnerHTML={{__html: proposed.bodyHtml}} />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-6 border-t border-white/10 mt-6">
         <Button 
           variant="ghost" 
           className="text-white hover:bg-white/10 hover:text-white"
           onClick={onSkip}
           disabled={isApproving}
         >
           Ignorar
         </Button>
         <Button 
           className="bg-[#D6F45B] text-[#0F0F0F] hover:brightness-110 font-bold px-8 shadow-[0_0_20px_rgba(214,244,91,0.3)] transition-all"
           onClick={onApprove}
           disabled={isApproving}
         >
           {isApproving ? <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-[#0F0F0F] border-t-transparent rounded-full animate-spin"/> Aplicando en Vivo...</span> : <span className="flex items-center gap-2"><CloudUpload className="w-4 h-4" /> Aprobar y Subir</span>}
         </Button>
      </div>
    </div>
  )
}

export default function AuditorDashboard() {
  const { settings } = useUserSettings()
  
  const [stats, setStats] = React.useState({ total_audited: 0, total_failed: 0, total_pending: 0 })
  const [isFetchingStats, setIsFetchingStats] = React.useState(false)
  
  const [batchSize, setBatchSize] = React.useState(50)
  const [cursor, setCursor] = React.useState<string | null>(null)
  
  const [productsQueue, setProductsQueue] = React.useState<AuditableProduct[]>([])
  const [currentProductIndex, setCurrentProductIndex] = React.useState(0)
  
  const [proposedData, setProposedData] = React.useState<any>(null)
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [isApproving, setIsApproving] = React.useState(false)

  // 1. Fetch de Cola
  const handleFetchBatch = async () => {
    if (!settings.shopify_domain || !settings.shopify_access_token) {
        alert("Configura tu dominio y token de Shopify en Ajustes primero.");
        return;
    }

    setIsFetchingStats(true)
    try {
      const res = await fetch("/api/shopify/audit/get-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            shopDomain: settings.shopify_domain,
            accessToken: settings.shopify_access_token,
            apiVersion: settings.shopify_api_version,
            limit: batchSize,
            cursor: cursor
        })
      })
      const data = await res.json()
      if (data.success) {
          setProductsQueue(data.products)
          setCurrentProductIndex(0)
          setCursor(data.pageInfo.endCursor)
          setStats({
            total_audited: data.globalStats.total_audited,
            total_failed: data.globalStats.total_failed,
            total_pending: data.totalRemainingAtCurrentFetch
          })
      } else {
          alert("Error al obtener lote: " + (data.error || "Desconocido"))
      }
    } catch (e) {
      alert("Error de red");
    } finally {
      setIsFetchingStats(false)
    }
  }

  // 2. Generar Propuesta de IA para el producto actual
  const generateProposal = async (product: AuditableProduct) => {
    setIsGenerating(true)
    setProposedData(null)
    
    // Extraer tamaño si existe en variante
    const sizeMatch = product.title.match(/(\d+)\s*(ml|oz|g)/i)
    const detectedSize = sizeMatch ? sizeMatch[0] : "";

    try {
       const aiProvider = settings.ai_provider || "gemini";
       const aiModel = aiProvider === "openai" 
         ? (settings.ai_openai_model || "gpt-4o-mini")
         : (settings.ai_gemini_model || "gemini-2.5-flash");

       const res = await fetch("/api/generate", {
         method: "POST",
         headers: { "Content-Type" : "application/json" },
         body: JSON.stringify({
           provider: aiProvider, 
           modelVersion: aiModel,
           apiKey: settings.ai_api_key,
           product: {
               Nombre: product.title,
               Marca: product.vendor,
               Tamaño: detectedSize
           },
           htmlTemplate: product.bodyHtml
         })
       });
       
       const aiResult = await res.json()
       if (aiResult.error) {
           alert("Error de IA: " + aiResult.error + (aiResult.details ? "\nDetalle: " + JSON.stringify(aiResult.details) : ""))
       } else {
           setProposedData({
               title: aiResult.title,
               bodyHtml: aiResult.body_html,
               seoTitle: aiResult.seo_title,
               seoDescription: aiResult.seo_description,
               tags: aiResult.tags ? aiResult.tags.split(",").map((s:string) => s.trim()) : []
           })
       }
    } catch (e) {
       console.error("Fallo IA", e)
       alert("Error de red al contactar la IA.")
    } finally {
       setIsGenerating(false)
    }
  }

  // Autogenerar cuando cambia el indice
  React.useEffect(() => {
    if (productsQueue.length > 0 && currentProductIndex < productsQueue.length) {
        generateProposal(productsQueue[currentProductIndex])
    }
  }, [currentProductIndex, productsQueue])

  // 3. Aprobar y Subir
  const handleApprove = async () => {
    if (!proposedData) return;
    setIsApproving(true)
    
    const currentProd = productsQueue[currentProductIndex]

    try {
        const res = await fetch("/api/shopify/audit/apply", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                shopDomain: settings.shopify_domain,
                accessToken: settings.shopify_access_token,
                productId: currentProd.id,
                updateData: {
                    title: proposedData.title,
                    bodyHtml: proposedData.bodyHtml,
                    seoTitle: proposedData.seoTitle,
                    seoDescription: proposedData.seoDescription,
                    tags: [...new Set([...currentProd.tags, ...proposedData.tags])]
                }
            })
        });
        
        const rData = await res.json();
        if (rData.success) {
            // Ir al siguiente
            setCurrentProductIndex(prev => prev + 1)
        } else {
            alert("Error al aplicar en Shopify: " + JSON.stringify(rData.error))
        }
    } catch (e) {
        alert("Error de red al aplicar.")
    } finally {
        setIsApproving(false)
    }
  }

  const handleSkip = () => {
     // TODO: Could also track "skipped" in Supabase so it stops asking.
     setCurrentProductIndex(prev => prev + 1)
  }

  const isQueueFinished = productsQueue.length > 0 && currentProductIndex >= productsQueue.length;
  const activeProduct = productsQueue[currentProductIndex]

  return (
    <main className="max-w-[1200px] mx-auto px-6 py-8 space-y-8 min-h-screen">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
           <div className="flex items-center gap-3">
             <h1 className="text-3xl font-bold tracking-tight text-[#1A1A1A]">Auditor Inteligente v3</h1>
             <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#0F0F0F] text-[#D6F45B]">
               Dry-Run Mode
             </span>
           </div>
           <p className="text-[#8C8C8C]">Analiza tu catálogo en vivo, corrige alucinaciones y sube los cambios aprobados.</p>
        </div>
        <Link href="/">
           <Button variant="outline" className="gap-2"><ArrowRight className="w-4 h-4 rotate-180" /> Volver al Importador</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1 border-t-4 border-t-[#D6F45B] shadow-lg">
           <CardHeader className="pb-2">
             <CardTitle className="text-xl flex items-center gap-2"><Activity className="w-5 h-5 text-[#D6F45B]" /> Estado del Catálogo</CardTitle>
           </CardHeader>
           <CardContent className="space-y-4">
             <div className="flex justify-between items-end border-b pb-2">
                <span className="text-sm text-gray-500">Completados (Supabase)</span>
                <span className="text-2xl font-bold font-mono">{stats.total_audited}</span>
             </div>
             <div className="flex justify-between items-end">
                <span className="text-sm text-gray-500">Lote en Cola Restante</span>
                <span className="text-2xl font-bold font-mono text-amber-500">{productsQueue.length === 0 ? "0" : (productsQueue.length - currentProductIndex)}</span>
             </div>
             
             {productsQueue.length === 0 ? (
                 <div className="pt-4 border-t flex flex-col gap-3">
                     <label className="text-sm font-medium">Tamaño del Lote (Batch):</label>
                     <input 
                       type="number" 
                       value={batchSize} 
                       onChange={e=>setBatchSize(Number(e.target.value))}
                       className="border rounded p-2"
                     />
                     <Button 
                       onClick={handleFetchBatch} 
                       disabled={isFetchingStats} 
                       className="w-full bg-[#1A1A1A] hover:bg-[#D6F45B] hover:text-black transition-colors"
                     >
                        <Play className="w-4 h-4 mr-2" />
                        {isFetchingStats ? "Cargando Lote..." : "Cargar Siguiente Lote"}
                     </Button>
                 </div>
             ) : (
                 <div className="pt-4 border-t">
                     <p className="text-xs text-gray-500 text-center">Buscando notas reales en Fragrantica y reescribiendo descripciones...</p>
                 </div>
             )}
           </CardContent>
        </Card>
        
        <div className="col-span-1 md:col-span-2">
           {productsQueue.length === 0 && !isFetchingStats && (
              <div className="h-full border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center p-12 text-center text-gray-500 space-y-4">
                  <ShieldCheck className="w-16 h-16 text-gray-300" />
                  <div>
                      <h3 className="font-semibold text-lg text-gray-800">Carga un lote para empezar</h3>
                      <p className="max-w-sm mt-1">El auditor traerá productos que nunca se hayan corregido y te mostrará un "Antes y Después" generado por IA.</p>
                  </div>
              </div>
           )}

           {isQueueFinished && (
              <div className="h-full border-2 border-dashed border-[#D6F45B] bg-[#D6F45B]/5 rounded-2xl flex flex-col items-center justify-center p-12 text-center text-gray-800 space-y-4">
                  <div className="w-16 h-16 bg-[#D6F45B] rounded-full flex items-center justify-center">
                     <ShieldCheck className="w-8 h-8 text-black" />
                  </div>
                  <div>
                      <h3 className="font-bold text-2xl">¡Lote Completado!</h3>
                      <p className="max-w-sm mt-2 text-gray-600">Has revisado todos los productos de este batch. Carga el siguiente lote para continuar purificando el catálogo.</p>
                  </div>
              </div>
           )}

           {!isQueueFinished && activeProduct && (
               <div className="space-y-4">
                  <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm font-mono text-sm border border-gray-100">
                      <span>Progreso del Batch: {currentProductIndex + 1} / {productsQueue.length}</span>
                      <span className="text-gray-400">ID: {activeProduct.id.split("/").pop()}</span>
                  </div>

                  {isGenerating ? (
                      <div className="bg-[#0F0F0F] rounded-xl p-16 flex flex-col items-center justify-center space-y-4 shadow-2xl">
                          <BrainCircuit className="w-12 h-12 text-[#D6F45B] animate-pulse" />
                          <p className="text-[#D6F45B] font-medium tracking-wide">Scrapeando Fragrantica & Generando Copy Premium...</p>
                      </div>
                  ) : proposedData ? (
                      <ProductDiff 
                        original={activeProduct} 
                        proposed={proposedData} 
                        isApproving={isApproving}
                        onApprove={handleApprove}
                        onSkip={handleSkip}
                      />
                  ) : null}
               </div>
           )}
        </div>
      </div>
    </main>
  )
}

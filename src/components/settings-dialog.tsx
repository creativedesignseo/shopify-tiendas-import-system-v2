import * as React from "react"
import { Settings, Save, Eye, EyeOff, Loader2, CheckCircle, XCircle, Store, RefreshCw } from "lucide-react"
import { useUserSettings } from "@/hooks/use-user-settings"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function SettingsDialog() {
  const { settings, updateSettings } = useUserSettings()
  const [open, setOpen] = React.useState(false)
  const [showSaveSuccessDialog, setShowSaveSuccessDialog] = React.useState(false)
  const [provider, setProvider] = React.useState("gemini")
  const [apiKey, setApiKey] = React.useState("")
  const [geminiModelVersion, setGeminiModelVersion] = React.useState("gemini-2.5-flash")
  const [openaiModelVersion, setOpenaiModelVersion] = React.useState("gpt-4o-mini")
  const [showApiKey, setShowApiKey] = React.useState(false)

  // Shopify settings state
  const [shopDomain, setShopDomain] = React.useState("")
  const [shopAccessToken, setShopAccessToken] = React.useState("")
  const [shopApiVersion, setShopApiVersion] = React.useState("2025-01")
  const [shopProfileName, setShopProfileName] = React.useState("")
  const [shopOutputMode, setShopOutputMode] = React.useState("csv_only")
  const [showShopToken, setShowShopToken] = React.useState(false)
  const [defaultInventoryQty, setDefaultInventoryQty] = React.useState("10")
  const [publicationMode, setPublicationMode] = React.useState<"all" | "custom">("all")
  const [publications, setPublications] = React.useState<Array<{ id: string; name: string }>>([])
  const [selectedPublicationIds, setSelectedPublicationIds] = React.useState<string[]>([])
  const [isLoadingPublications, setIsLoadingPublications] = React.useState(false)

  // Connection test state
  const [connectionStatus, setConnectionStatus] = React.useState<"idle" | "testing" | "connected" | "error">("idle")
  const [connectionInfo, setConnectionInfo] = React.useState("")

  // Load settings from Supabase when dialog opens
  React.useEffect(() => {
    if (open) {
      setProvider(settings.ai_provider)
      setApiKey(settings.ai_api_key)
      setGeminiModelVersion(settings.ai_gemini_model)
      setOpenaiModelVersion(settings.ai_openai_model)
      setShopDomain(settings.shopify_domain)
      setShopAccessToken(settings.shopify_access_token)
      setShopApiVersion(settings.shopify_api_version)
      setShopProfileName("")
      setShopOutputMode(settings.output_mode)
      setDefaultInventoryQty(String(settings.default_inventory_qty))
      setPublicationMode(settings.publication_mode === "custom" ? "custom" : "all")
      setSelectedPublicationIds(settings.publication_ids || [])
      setPublications([])

      // Reset connection status on open
      setConnectionStatus(settings.shopify_domain ? "connected" : "idle")
      setConnectionInfo(settings.shopify_domain ? "Conectado previamente" : "")
    }
  }, [open, settings])

  const getCurrentFormData = () => ({
    ai_provider: provider,
    ai_api_key: apiKey,
    ai_gemini_model: geminiModelVersion,
    ai_openai_model: openaiModelVersion,
    shopify_domain: shopDomain,
    shopify_access_token: shopAccessToken,
    shopify_api_version: shopApiVersion,
    output_mode: shopOutputMode,
    default_inventory_qty: Number(defaultInventoryQty) || 10,
    publication_mode: publicationMode,
    publication_ids: selectedPublicationIds,
  })

  const handleSave = async () => {
    await updateSettings(getCurrentFormData())
    setOpen(false)
    setShowSaveSuccessDialog(true)
  }

  // Auto-save when dialog closes (so data isn't lost if user leaves to copy something)
  const handleOpenChange = async (isOpen: boolean) => {
    if (!isOpen && open) {
      await updateSettings(getCurrentFormData())
    }
    setOpen(isOpen)
  }

  const handleLoadPublications = async () => {
    if (!shopDomain || !shopAccessToken) {
      setConnectionStatus("error")
      setConnectionInfo("Primero completa dominio y token de Shopify")
      return
    }

    setIsLoadingPublications(true)
    try {
      const res = await fetch("/api/shopify/publications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopDomain,
          accessToken: shopAccessToken,
          apiVersion: shopApiVersion,
        }),
      })
      const data = await res.json()
      if (!data.success) {
        setConnectionStatus("error")
        setConnectionInfo(data.error || "No se pudieron cargar los canales")
        return
      }

      const channels: Array<{ id: string; name: string }> = data.publications || []
      setPublications(channels)

      if (channels.length > 0) {
        const existing = new Set(selectedPublicationIds)
        const validExisting = channels.filter((c) => existing.has(c.id)).map((c) => c.id)
        setSelectedPublicationIds(validExisting.length > 0 ? validExisting : channels.map((c) => c.id))
      } else {
        setSelectedPublicationIds([])
      }
    } catch (err: any) {
      setConnectionStatus("error")
      setConnectionInfo(err.message || "No se pudieron cargar los canales")
    } finally {
      setIsLoadingPublications(false)
    }
  }

  const handleTestConnection = async () => {
    if (!shopDomain || !shopAccessToken) {
      setConnectionStatus("error")
      setConnectionInfo("Ingresa el dominio y el token de acceso")
      return
    }

    setConnectionStatus("testing")
    setConnectionInfo("Conectando...")

    try {
      const res = await fetch("/api/shopify/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopDomain,
          accessToken: shopAccessToken,
          apiVersion: shopApiVersion,
        }),
      })

      const data = await res.json()

      if (data.success) {
        setConnectionStatus("connected")
        setConnectionInfo(`${data.shop.name} — ${data.shop.domain}`)
        updateSettings({
          shopify_shop_name: data.shop.name || "",
          shopify_products_count: data.shop.productsCount ?? 0,
        })
        await handleLoadPublications()
      } else {
        setConnectionStatus("error")
        setConnectionInfo(data.error || "Error de conexión")
        updateSettings({ shopify_shop_name: "", shopify_products_count: 0 })
      }
    } catch (err: any) {
      setConnectionStatus("error")
      setConnectionInfo(err.message || "No se puede conectar")
      updateSettings({ shopify_shop_name: "", shopify_products_count: 0 })
    }
  }

  const selectClass = "flex h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#D6F45B] focus:shadow-[0_0_0_2px_rgba(214,244,91,0.2)] disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-250"

  return (
    <>
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-xl">
          <Settings className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[95vw] max-w-[550px] rounded-2xl max-h-[85vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Configuración</DialogTitle>
          <DialogDescription>
            Configura tu IA y conexión a Shopify. Los datos se guardan en tu cuenta.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="ia" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="ia" className="flex-1">IA</TabsTrigger>
            <TabsTrigger value="shopify" className="flex-1">
              <Store className="w-4 h-4 mr-1.5" />
              Shopify
            </TabsTrigger>
          </TabsList>

          {/* IA Tab */}
          <TabsContent value="ia">
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="provider" className="text-right text-[#1A1A1A]">
                  Modelo
                </Label>
                <div className="col-span-3">
                    <select
                        id="provider"
                        value={provider}
                        onChange={(e) => setProvider(e.target.value)}
                        className={selectClass}
                    >
                        <option value="gemini">Google Gemini (Recomendado)</option>
                        <option value="openai">OpenAI (ChatGPT)</option>
                    </select>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="api-key" className="text-right text-[#1A1A1A]">
                  API Key
                </Label>
                <div className="col-span-3 relative">
                    <Input
                      id="api-key"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      type={showApiKey ? "text" : "password"}
                      className="pr-10"
                      placeholder={provider === "gemini" ? "AIzaSy... (Dejar vacío para usar .env)" : "sk-... (Dejar vacío para usar .env)"}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? (
                        <EyeOff className="h-4 w-4 text-[#8C8C8C]" />
                      ) : (
                        <Eye className="h-4 w-4 text-[#8C8C8C]" />
                      )}
                    </Button>
                </div>
                <p className="text-[10px] text-[#8C8C8C] col-span-4 text-right">
                  {apiKey && apiKey.length > 4
                    ? `Key actual: ••••••••${apiKey.slice(-4)}`
                    : "Si se deja vacío, se utilizará la API Key configurada en el servidor (.env)"}
                </p>
              </div>

              {provider === "gemini" && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="model-version" className="text-right text-[#1A1A1A]">
                    Versión
                  </Label>
                  <div className="col-span-3">
                      <select
                          id="model-version"
                          value={geminiModelVersion}
                          onChange={(e) => setGeminiModelVersion(e.target.value)}
                          className={selectClass}
                      >
                          <option value="gemini-2.5-flash">Gemini 2.5 Flash (Stable - Recomendado)</option>
                          <option value="gemini-3-flash-preview">Gemini 3.0 Flash (Preview - ¡Nuevo!)</option>
                          <option value="gemini-2.0-flash">Gemini 2.0 Flash (Legacy)</option>
                          <option value="gemini-1.5-flash-latest">Gemini 1.5 Flash (Deprecated)</option>
                      </select>
                  </div>
                </div>
              )}
              {provider === "openai" && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="openai-model-version" className="text-right text-[#1A1A1A]">
                    Versión
                  </Label>
                  <div className="col-span-3">
                    <select
                      id="openai-model-version"
                      value={openaiModelVersion}
                      onChange={(e) => setOpenaiModelVersion(e.target.value)}
                      className={selectClass}
                    >
                      <option value="gpt-4o-mini">GPT-4o mini (Recomendado)</option>
                      <option value="gpt-4.1-mini">GPT-4.1 mini</option>
                      <option value="gpt-4o">GPT-4o</option>
                      <option value="gpt-4.1">GPT-4.1</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Shopify Tab */}
          <TabsContent value="shopify">
            <div className="grid gap-4 py-4">
              {/* Profile Name */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="shop-profile" className="text-right text-[#1A1A1A]">
                  Perfil
                </Label>
                <div className="col-span-3">
                  <Input
                    id="shop-profile"
                    value={shopProfileName}
                    onChange={(e) => setShopProfileName(e.target.value)}
                    placeholder="Mi Tienda Principal"
                  />
                </div>
              </div>

              {/* Shop Domain */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="shop-domain" className="text-right text-[#1A1A1A]">
                  Dominio
                </Label>
                <div className="col-span-3">
                  <Input
                    id="shop-domain"
                    value={shopDomain}
                    onChange={(e) => setShopDomain(e.target.value)}
                    placeholder="tu-tienda.myshopify.com"
                  />
                </div>
              </div>

              {/* Access Token */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="shop-token" className="text-right text-[#1A1A1A]">
                  Token
                </Label>
                <div className="col-span-3 relative">
                  <Input
                    id="shop-token"
                    value={shopAccessToken}
                    onChange={(e) => setShopAccessToken(e.target.value)}
                    type={showShopToken ? "text" : "password"}
                    className="pr-10"
                    placeholder="shpat_xxx..."
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowShopToken(!showShopToken)}
                  >
                    {showShopToken ? (
                      <EyeOff className="h-4 w-4 text-[#8C8C8C]" />
                    ) : (
                      <Eye className="h-4 w-4 text-[#8C8C8C]" />
                    )}
                  </Button>
                </div>
                <p className="text-[10px] text-[#8C8C8C] col-span-4 text-right">
                  {shopAccessToken && shopAccessToken.length > 4
                    ? `Token: ••••••••${shopAccessToken.slice(-4)}`
                    : "Admin API access token de tu app Shopify"}
                </p>
              </div>

              {/* API Version */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="shop-version" className="text-right text-[#1A1A1A]">
                  API Ver.
                </Label>
                <div className="col-span-3">
                  <select
                    id="shop-version"
                    value={shopApiVersion}
                    onChange={(e) => setShopApiVersion(e.target.value)}
                    className={selectClass}
                  >
                    <option value="2025-01">2025-01 (Recomendado)</option>
                    <option value="2024-10">2024-10</option>
                    <option value="2024-07">2024-07</option>
                  </select>
                </div>
              </div>

              {/* Test Connection */}
              <div className="grid grid-cols-4 items-center gap-4">
                <div className="col-start-2 col-span-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={connectionStatus === "testing"}
                    className="w-full"
                  >
                    {connectionStatus === "testing" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {connectionStatus === "connected" && <CheckCircle className="w-4 h-4 mr-2 text-green-500" />}
                    {connectionStatus === "error" && <XCircle className="w-4 h-4 mr-2 text-red-500" />}
                    {connectionStatus === "idle" && <Store className="w-4 h-4 mr-2" />}
                    Test Connection
                  </Button>
                  {connectionInfo && (
                    <p className={`text-[11px] mt-1.5 ${connectionStatus === "error" ? "text-red-500" : "text-green-600"}`}>
                      {connectionInfo}
                    </p>
                  )}
                </div>
              </div>

              {/* Output Mode */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right text-[#1A1A1A]">
                  Modo
                </Label>
                <div className="col-span-3 space-y-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="outputMode"
                      value="csv_only"
                      checked={shopOutputMode === "csv_only"}
                      onChange={(e) => setShopOutputMode(e.target.value)}
                      className="accent-[#D6F45B]"
                    />
                    Solo CSV (actual)
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="outputMode"
                      value="shopify_only"
                      checked={shopOutputMode === "shopify_only"}
                      onChange={(e) => setShopOutputMode(e.target.value)}
                      className="accent-[#D6F45B]"
                    />
                    Solo Shopify Live
                    <span className="text-[10px] bg-[#EBEBEB] px-1.5 py-0.5 rounded">Ciclo 2</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="outputMode"
                      value="csv_and_shopify"
                      checked={shopOutputMode === "csv_and_shopify"}
                      onChange={(e) => setShopOutputMode(e.target.value)}
                      className="accent-[#D6F45B]"
                    />
                    CSV + Shopify Live
                    <span className="text-[10px] bg-[#EBEBEB] px-1.5 py-0.5 rounded">Ciclo 2</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="shop-inventory" className="text-right text-[#1A1A1A]">
                  Inventario
                </Label>
                <div className="col-span-3">
                  <Input
                    id="shop-inventory"
                    type="number"
                    min={0}
                    value={defaultInventoryQty}
                    onChange={(e) => setDefaultInventoryQty(e.target.value)}
                    placeholder="10"
                  />
                  <p className="text-[10px] text-[#8C8C8C] mt-1">
                    Cantidad por defecto para productos nuevos.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <Label className="text-right text-[#1A1A1A] pt-2">Canales</Label>
                <div className="col-span-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleLoadPublications}
                      disabled={isLoadingPublications}
                    >
                      {isLoadingPublications ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      Cargar canales
                    </Button>
                    <span className="text-[10px] text-[#8C8C8C]">Todos activos por defecto.</span>
                  </div>

                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="publicationMode"
                      checked={publicationMode === "all"}
                      onChange={() => setPublicationMode("all")}
                      className="accent-[#D6F45B]"
                    />
                    Activar todos los canales
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="publicationMode"
                      checked={publicationMode === "custom"}
                      onChange={() => setPublicationMode("custom")}
                      className="accent-[#D6F45B]"
                    />
                    Elegir canales manualmente
                  </label>

                  {publicationMode === "custom" && (
                    <div className="max-h-32 overflow-y-auto border border-[#E5E7EB] rounded-xl p-2 space-y-1">
                      {publications.length === 0 && (
                        <p className="text-xs text-[#8C8C8C]">Carga los canales para seleccionarlos.</p>
                      )}
                      {publications.map((channel) => (
                        <label key={channel.id} className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedPublicationIds.includes(channel.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPublicationIds((prev) => [...prev, channel.id])
                              } else {
                                setSelectedPublicationIds((prev) => prev.filter((id) => id !== channel.id))
                              }
                            }}
                            className="accent-[#D6F45B]"
                          />
                          {channel.name}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button onClick={handleSave}>
             <Save className="w-4 h-4 mr-2" />
             Guardar Cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={showSaveSuccessDialog} onOpenChange={setShowSaveSuccessDialog}>
      <DialogContent className="w-[90vw] max-w-sm rounded-2xl border-[#E5E7EB] text-center p-6 sm:p-8 [&>button]:hidden">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-[#D6F45B] flex items-center justify-center mb-1">
            <CheckCircle className="h-8 w-8 sm:h-10 sm:w-10 text-[#0F0F0F]" />
          </div>
          <DialogTitle className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F0F0F]">
            ¡Guardado!
          </DialogTitle>
          <DialogDescription className="text-[#8C8C8C] text-base sm:text-lg font-medium max-w-[280px] mx-auto">
            La configuración se guardó correctamente.
          </DialogDescription>
          <Button
            className="mt-4 w-full rounded-xl bg-[#0F0F0F] text-white hover:bg-[#2A2A2A] py-4 sm:py-5 text-base font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F0F0F] focus-visible:ring-offset-2"
            onClick={() => setShowSaveSuccessDialog(false)}
          >
            Continuar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}




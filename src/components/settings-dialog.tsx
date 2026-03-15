
import * as React from "react"
import { Settings, Save, Eye, EyeOff, Loader2, CheckCircle, XCircle, Store } from "lucide-react"
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
  const [open, setOpen] = React.useState(false)
  const [provider, setProvider] = React.useState("gemini")
  const [apiKey, setApiKey] = React.useState("")
  const [modelVersion, setModelVersion] = React.useState("gemini-2.5-flash")
  const [showApiKey, setShowApiKey] = React.useState(false)

  // Shopify settings state
  const [shopDomain, setShopDomain] = React.useState("")
  const [shopAccessToken, setShopAccessToken] = React.useState("")
  const [shopApiVersion, setShopApiVersion] = React.useState("2025-01")
  const [shopProfileName, setShopProfileName] = React.useState("")
  const [shopOutputMode, setShopOutputMode] = React.useState("csv_only")
  const [showShopToken, setShowShopToken] = React.useState(false)

  // Connection test state
  const [connectionStatus, setConnectionStatus] = React.useState<"idle" | "testing" | "connected" | "error">("idle")
  const [connectionInfo, setConnectionInfo] = React.useState("")

  React.useEffect(() => {
    if (open) {
      // Load AI settings
      const storedProvider = localStorage.getItem("ai_provider") || "gemini"
      const storedKey = localStorage.getItem("ai_api_key") || ""
      const storedModel = localStorage.getItem("ai_model_version") || "gemini-2.5-flash"
      setProvider(storedProvider)
      setApiKey(storedKey)
      setModelVersion(storedModel)

      // Load Shopify settings
      const storedDomain = localStorage.getItem("shopify_shop_domain") || ""
      const storedToken = localStorage.getItem("shopify_access_token") || ""
      const storedVersion = localStorage.getItem("shopify_api_version") || "2025-01"
      const storedProfile = localStorage.getItem("shopify_profile_name") || ""
      const storedMode = localStorage.getItem("shopify_output_mode") || "csv_only"
      setShopDomain(storedDomain)
      setShopAccessToken(storedToken)
      setShopApiVersion(storedVersion)
      setShopProfileName(storedProfile)
      setShopOutputMode(storedMode)

      // Reset connection status on open
      const wasConnected = localStorage.getItem("shopify_connected") === "true"
      setConnectionStatus(wasConnected ? "connected" : "idle")
      setConnectionInfo(wasConnected ? "Conectado previamente" : "")
    }
  }, [open])

  const handleSave = () => {
    // Save AI settings
    localStorage.setItem("ai_provider", provider)
    localStorage.setItem("ai_api_key", apiKey)
    localStorage.setItem("ai_model_version", modelVersion)

    // Save Shopify settings
    localStorage.setItem("shopify_shop_domain", shopDomain)
    localStorage.setItem("shopify_access_token", shopAccessToken)
    localStorage.setItem("shopify_api_version", shopApiVersion)
    localStorage.setItem("shopify_profile_name", shopProfileName)
    localStorage.setItem("shopify_output_mode", shopOutputMode)

    setOpen(false)
    alert("✅ Configuración guardada.")
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
        localStorage.setItem("shopify_connected", "true")
        localStorage.setItem("shopify_shop_name", data.shop.name || "")
        localStorage.setItem("shopify_products_count", String(data.shop.productsCount ?? 0))
      } else {
        setConnectionStatus("error")
        setConnectionInfo(data.error || "Error de conexión")
        localStorage.setItem("shopify_connected", "false")
        localStorage.removeItem("shopify_shop_name")
        localStorage.removeItem("shopify_products_count")
      }
    } catch (err: any) {
      setConnectionStatus("error")
      setConnectionInfo(err.message || "No se puede conectar")
      localStorage.setItem("shopify_connected", "false")
      localStorage.removeItem("shopify_shop_name")
      localStorage.removeItem("shopify_products_count")
    }
  }

  const selectClass = "flex h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#D6F45B] focus:shadow-[0_0_0_2px_rgba(214,244,91,0.2)] disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-250"

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-xl">
          <Settings className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px] rounded-2xl">
        <DialogHeader>
          <DialogTitle>Configuración</DialogTitle>
          <DialogDescription>
            Configura tu IA y conexión a Shopify. Los datos se guardan en tu navegador.
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
                          value={modelVersion}
                          onChange={(e) => setModelVersion(e.target.value)}
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
  )
}

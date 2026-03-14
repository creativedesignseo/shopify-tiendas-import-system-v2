
import * as React from "react"
import { Settings, Save, Eye, EyeOff } from "lucide-react"
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

export function SettingsDialog() {
  const [open, setOpen] = React.useState(false)
  const [provider, setProvider] = React.useState("gemini")
  const [apiKey, setApiKey] = React.useState("")
  const [modelVersion, setModelVersion] = React.useState("gemini-2.5-flash")
  const [showApiKey, setShowApiKey] = React.useState(false)


  React.useEffect(() => {
    if (open) {
      const storedProvider = localStorage.getItem("ai_provider") || "gemini"
      const storedKey = localStorage.getItem("ai_api_key") || ""
      const storedModel = localStorage.getItem("ai_model_version") || "gemini-2.5-flash"
      setProvider(storedProvider)
      setApiKey(storedKey)
      setModelVersion(storedModel)
    }
  }, [open])

  const handleSave = () => {
    localStorage.setItem("ai_provider", provider)
    localStorage.setItem("ai_api_key", apiKey)
    localStorage.setItem("ai_model_version", modelVersion)
    setOpen(false)
    // Optional: Trigger a toast or alert
    alert("✅ Configuración guardada.")
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-xl">
          <Settings className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] rounded-2xl">
        <DialogHeader>
          <DialogTitle>Configuración IA</DialogTitle>
          <DialogDescription>
            Elige el modelo y tu clave API. Tus datos se guardan localmente en tu navegador.
          </DialogDescription>
        </DialogHeader>
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
                    className="flex h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#D6F45B] focus:shadow-[0_0_0_2px_rgba(214,244,91,0.2)] disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-250"
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
                      className="flex h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#D6F45B] focus:shadow-[0_0_0_2px_rgba(214,244,91,0.2)] disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-250"
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

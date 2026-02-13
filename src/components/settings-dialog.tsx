
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
  const [modelVersion, setModelVersion] = React.useState("gemini-2.0-flash")
  const [showApiKey, setShowApiKey] = React.useState(false)


  React.useEffect(() => {
    if (open) {
      const storedProvider = localStorage.getItem("ai_provider") || "gemini"
      const storedKey = localStorage.getItem("ai_api_key") || ""
      const storedModel = localStorage.getItem("ai_model_version") || "gemini-2.0-flash"
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
        <Button variant="ghost" size="icon" className="rounded-full">
          <Settings className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Configuración IA</DialogTitle>
          <DialogDescription>
            Elige el modelo y tu clave API. Tus datos se guardan localmente en tu navegador.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="provider" className="text-right">
              Modelo
            </Label>
            <div className="col-span-3">
                <select 
                    id="provider"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <option value="gemini">Google Gemini (Recomendado)</option>
                    <option value="openai">OpenAI (ChatGPT)</option>
                </select>
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="api-key" className="text-right">
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
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
            </div>
            <p className="text-[10px] text-muted-foreground col-span-4 text-right">
              {apiKey && apiKey.length > 4 
                ? `Key actual: ••••••••${apiKey.slice(-4)}`
                : "Si se deja vacío, se utilizará la API Key configurada en el servidor (.env)"}
            </p>
          </div>

          {provider === "gemini" && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="model-version" className="text-right">
                Versión
              </Label>
              <div className="col-span-3">
                  <select 
                      id="model-version"
                      value={modelVersion}
                      onChange={(e) => setModelVersion(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                      <option value="gemini-2.0-flash">Gemini 2.0 Flash (Recomendado)</option>
                      <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash Lite</option>
                      <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                      <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                  </select>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={handleSave} className="bg-black text-white rounded-full">
             <Save className="w-4 h-4 mr-2" />
             Guardar Cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

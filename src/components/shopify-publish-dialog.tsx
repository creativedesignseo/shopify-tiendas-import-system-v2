"use client";

import * as React from "react";
import { Loader2, CheckCircle, XCircle, AlertTriangle, Download, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { ProcessedProduct } from "@/lib/product-processor";
import type { CreateProductResult } from "@/lib/shopify-client";

interface ShopifyPublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: ProcessedProduct[];
  onPublishComplete: (results: CreateProductResult[]) => void;
}

export function ShopifyPublishDialog({
  open,
  onOpenChange,
  products,
  onPublishComplete,
}: ShopifyPublishDialogProps) {
  const [phase, setPhase] = React.useState<"confirm" | "publishing" | "complete">("confirm");
  const [dryRun, setDryRun] = React.useState(false);
  const [results, setResults] = React.useState<CreateProductResult[]>([]);
  const [progress, setProgress] = React.useState(0);
  const [currentProduct, setCurrentProduct] = React.useState("");
  const [error, setError] = React.useState("");

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open) {
      setPhase("confirm");
      setDryRun(false);
      setResults([]);
      setProgress(0);
      setCurrentProduct("");
      setError("");
    }
  }, [open]);

  const shopName = typeof window !== "undefined"
    ? localStorage.getItem("shopify_profile_name") || localStorage.getItem("shopify_shop_domain") || "Shopify"
    : "Shopify";

  const handlePublish = async () => {
    setPhase("publishing");
    setProgress(0);

    const shopDomain = localStorage.getItem("shopify_shop_domain") || "";
    const accessToken = localStorage.getItem("shopify_access_token") || "";
    const apiVersion = localStorage.getItem("shopify_api_version") || "2025-01";
    const publicationMode = (localStorage.getItem("shopify_publication_mode") || "all") as "all" | "custom";
    const publicationIds = (() => {
      try {
        const raw = localStorage.getItem("shopify_publication_ids");
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })();
    const defaultInventoryQuantity = Number(localStorage.getItem("shopify_default_inventory_qty") || "10");

    if (!shopDomain || !accessToken) {
      setError("Faltan credenciales de Shopify. Configúralas en Ajustes.");
      setPhase("complete");
      return;
    }

    try {
      // Show progress simulation while API processes
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 1, products.length - 1));
      }, 1500);

      const res = await fetch("/api/shopify/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopDomain,
          accessToken,
          apiVersion,
          products,
          dryRun,
          publicationMode,
          publicationIds,
          defaultInventoryQuantity,
        }),
      });

      clearInterval(progressInterval);

      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Error durante la publicación");
        setResults([]);
        setPhase("complete");
        return;
      }

      setResults(data.results);
      setProgress(products.length);
      setPhase("complete");
      onPublishComplete(data.results);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error de conexión";
      setError(message);
      setPhase("complete");
    }
  };

  const summary = React.useMemo(() => {
    const created = results.filter((r) => r.status === "created").length;
    const skipped = results.filter((r) => r.status === "skipped").length;
    const failed = results.filter((r) => r.status === "failed").length;
    return { created, skipped, failed };
  }, [results]);

  const handleDownloadReport = () => {
    const lines = [
      `Reporte de Publicación — ${new Date().toLocaleString("es-ES")}`,
      `Tienda: ${shopName}`,
      `Modo: ${dryRun ? "Simulación (Dry Run)" : "Producción"}`,
      ``,
      `Resumen: ${summary.created} creados, ${summary.skipped} omitidos, ${summary.failed} fallidos`,
      ``,
      `--- Detalle ---`,
      ...results.map(
        (r, i) =>
          `${i + 1}. [${r.status.toUpperCase()}] ${r.title}${r.barcode ? ` (${r.barcode})` : ""}${r.error ? ` — ${r.error}` : ""}${r.handle ? ` → ${r.handle}` : ""}`
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shopify-publish-report-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={phase === "publishing" ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-[500px] rounded-2xl">
        <DialogHeader>
          <DialogTitle>
            {phase === "confirm" && "Publicar en Shopify"}
            {phase === "publishing" && "Publicando..."}
            {phase === "complete" && (dryRun ? "Simulación Completa" : "Publicación Completa")}
          </DialogTitle>
          <DialogDescription>
            {phase === "confirm" && `${products.length} producto${products.length !== 1 ? "s" : ""} listo${products.length !== 1 ? "s" : ""} para ${shopName}`}
            {phase === "publishing" && `Procesando producto ${Math.min(progress + 1, products.length)} de ${products.length}`}
            {phase === "complete" && (error ? "Ocurrió un error" : `${results.length} producto${results.length !== 1 ? "s" : ""} procesado${results.length !== 1 ? "s" : ""}`)}
          </DialogDescription>
        </DialogHeader>

        {/* Confirm Phase */}
        {phase === "confirm" && (
          <div className="py-4 space-y-4">
            <div className="bg-[#F9F9F9] rounded-xl p-4 text-sm space-y-2">
              <p><strong>Tienda:</strong> {shopName}</p>
              <p><strong>Productos:</strong> {products.length}</p>
            </div>

            <label className="flex items-center gap-3 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                className="accent-[#D6F45B] w-4 h-4"
              />
              <span>
                Simulación (Dry Run) — valida sin crear productos
              </span>
            </label>
          </div>
        )}

        {/* Publishing Phase */}
        {phase === "publishing" && (
          <div className="py-4 space-y-4">
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-[#D6F45B] h-3 rounded-full transition-all duration-500"
                style={{ width: `${(Math.min(progress + 1, products.length) / products.length) * 100}%` }}
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-[#8C8C8C]">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="truncate">{currentProduct || products[Math.min(progress, products.length - 1)]?.generatedTitle || "Procesando..."}</span>
            </div>
          </div>
        )}

        {/* Complete Phase */}
        {phase === "complete" && (
          <div className="py-4 space-y-4">
            {error && !results.length ? (
              <div className="flex items-center gap-2 text-red-500 text-sm">
                <XCircle className="w-5 h-5 shrink-0" />
                <span>{error}</span>
              </div>
            ) : (
              <>
                {/* Summary counters */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-green-50 rounded-xl p-3">
                    <div className="text-2xl font-bold text-green-600">{summary.created}</div>
                    <div className="text-xs text-green-700">{dryRun ? "Válidos" : "Creados"}</div>
                  </div>
                  <div className="bg-yellow-50 rounded-xl p-3">
                    <div className="text-2xl font-bold text-yellow-600">{summary.skipped}</div>
                    <div className="text-xs text-yellow-700">Omitidos</div>
                  </div>
                  <div className="bg-red-50 rounded-xl p-3">
                    <div className="text-2xl font-bold text-red-600">{summary.failed}</div>
                    <div className="text-xs text-red-700">Fallidos</div>
                  </div>
                </div>

                {/* Failed products detail */}
                {summary.failed > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-red-600">Productos fallidos:</p>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {results
                        .filter((r) => r.status === "failed")
                        .map((r, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs bg-red-50 rounded-lg p-2">
                            <XCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                            <div>
                              <span className="font-medium">{r.title}</span>
                              {r.error && <span className="text-red-500 block">{r.error}</span>}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Skipped products detail */}
                {summary.skipped > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-yellow-600">Productos omitidos (duplicados):</p>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {results
                        .filter((r) => r.status === "skipped")
                        .map((r, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs bg-yellow-50 rounded-lg p-2">
                            <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 mt-0.5 shrink-0" />
                            <div>
                              <span className="font-medium">{r.title}</span>
                              {r.error && <span className="text-yellow-600 block">{r.error}</span>}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <DialogFooter>
          {phase === "confirm" && (
            <div className="flex gap-2 w-full">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={handlePublish} className="flex-1 bg-[#1A1A1A] hover:bg-[#333] text-white">
                <Rocket className="w-4 h-4 mr-2" />
                {dryRun ? "Simular" : "Publicar"}
              </Button>
            </div>
          )}
          {phase === "complete" && (
            <div className="flex gap-2 w-full">
              {results.length > 0 && (
                <Button variant="outline" onClick={handleDownloadReport} className="flex-1">
                  <Download className="w-4 h-4 mr-2" />
                  Descargar Reporte
                </Button>
              )}
              <Button onClick={() => onOpenChange(false)} className="flex-1">
                Cerrar
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

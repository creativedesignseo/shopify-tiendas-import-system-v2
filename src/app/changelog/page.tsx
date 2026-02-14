"use client"

import Link from "next/link"
import versionData from "@/data/version.json"
import { ArrowLeft, Plus, Wrench, RefreshCw, Trash2 } from "lucide-react"

const typeConfig: Record<string, { label: string; icon: typeof Plus; color: string; bg: string }> = {
  added:   { label: "Añadido",  icon: Plus,      color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  fixed:   { label: "Corregido", icon: Wrench,   color: "text-blue-700",    bg: "bg-blue-50 border-blue-200" },
  changed: { label: "Cambiado", icon: RefreshCw, color: "text-amber-700",   bg: "bg-amber-50 border-amber-200" },
  removed: { label: "Eliminado", icon: Trash2,   color: "text-red-700",     bg: "bg-red-50 border-red-200" },
}

export default function ChangelogPage() {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      {/* Header */}
      <div className="border-b border-[var(--border)]">
        <div className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Historial de Versiones</h1>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              Todas las mejoras y correcciones de la aplicación
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full border border-[var(--border)] hover:bg-[var(--secondary)] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
        </div>
      </div>

      {/* Timeline */}
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="space-y-10">
          {versionData.releases.map((release, idx) => (
            <article key={release.version} className="relative">
              {/* Version Header */}
              <div className="flex items-center gap-3 mb-4">
                <span className={`
                  inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold
                  ${idx === 0
                    ? "bg-[var(--foreground)] text-[var(--background)]"
                    : "bg-[var(--secondary)] text-[var(--foreground)]"
                  }
                `}>
                  v{release.version}
                </span>
                <span className="text-sm text-[var(--muted-foreground)]">
                  {new Date(release.date + "T00:00:00").toLocaleDateString("es-ES", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
                {idx === 0 && (
                  <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Última
                  </span>
                )}
              </div>

              {/* Entries */}
              <div className="space-y-2 pl-1">
                {release.entries.map((entry, entryIdx) => {
                  const config = typeConfig[entry.type] || typeConfig.added
                  const Icon = config.icon
                  return (
                    <div
                      key={entryIdx}
                      className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${config.bg} transition-all`}
                    >
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${config.color}`} />
                      <div className="flex-1 min-w-0">
                        <span className={`text-xs font-semibold uppercase tracking-wide ${config.color}`}>
                          {config.label}
                        </span>
                        <p className="text-sm mt-0.5 text-[var(--foreground)]">
                          {entry.text}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Divider (except last) */}
              {idx < versionData.releases.length - 1 && (
                <div className="mt-10 border-t border-[var(--border)]" />
              )}
            </article>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-16 pb-10 text-center text-sm text-[var(--muted-foreground)]">
          <p>Shopify Import System — Construido con ❤️</p>
        </div>
      </div>
    </main>
  )
}

"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ImportSession } from "@/lib/backup-service"
import { ProcessedProduct } from "@/lib/product-processor"
import { RotateCcw, Download, Trash2, Clock, FileSpreadsheet, Check, AlertCircle, Loader2 } from "lucide-react"

interface SessionRecoveryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  session: ImportSession | null
  products: ProcessedProduct[]
  onRestore: () => void
  onAbandon: () => void
  onDownloadPartial: () => void
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "hace unos segundos"
  if (diffMins < 60) return `hace ${diffMins} min`
  if (diffHours < 24) return `hace ${diffHours}h`
  return `hace ${diffDays} día${diffDays > 1 ? 's' : ''}`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function SessionRecoveryDialog({
  open,
  onOpenChange,
  session,
  products,
  onRestore,
  onAbandon,
  onDownloadPartial,
}: SessionRecoveryDialogProps) {
  if (!session) return null

  const completed = products.filter(p => p.status === "complete").length
  const errors = products.filter(p => p.status === "error").length
  const pending = products.filter(p => p.status === "pending" || p.status === "generating").length
  const total = products.length
  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1200px] w-[95vw] max-h-[90vh] p-0 gap-0 overflow-hidden rounded-2xl flex flex-col">
        {/* Header with gradient - fixed */}
        <div className="shrink-0 bg-gradient-to-r from-[#0F0F0F] via-[#1A1A1A] to-[#0F0F0F] px-4 sm:px-6 py-4 sm:py-6 text-white">
           <div className="flex items-center gap-3 sm:gap-4 mb-1">
            <div className="bg-white/20 rounded-full p-2 sm:p-2.5 shrink-0">
              <RotateCcw className="h-5 w-5 sm:h-6 sm:w-6 text-white stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-lg sm:text-xl text-white font-semibold tracking-tight">
                Sesión Anterior Detectada
              </DialogTitle>
              <DialogDescription className="text-[#D6F45B] font-semibold text-xs sm:text-sm mt-1">
                Encontramos una sesión de trabajo sin completar
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
          <div className="px-3 sm:px-6 py-4 sm:py-6 space-y-3 sm:space-y-6">
            {/* File Info */}
            <div className="bg-[#F5F6F7] rounded-xl border border-[#E5E7EB] p-3 sm:p-5 space-y-3 sm:space-y-4 shadow-sm">
              <div className="flex items-center justify-between gap-2 sm:gap-3">
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                  <FileSpreadsheet className="h-5 w-5 sm:h-6 sm:w-6 text-[#0F0F0F] shrink-0 stroke-[2.5]" />
                  <div className="min-w-0">
                    <p className="font-semibold text-[#0F0F0F] text-sm sm:text-base truncate" title={session.file_name}>
                      {session.file_name}
                    </p>
                    <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-[#5C5C5C] mt-1 font-semibold flex-wrap">
                      <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                      <span>{formatDate(session.created_at)}</span>
                      <span className="text-[#EBEBEB] hidden sm:inline">•</span>
                      <span className="text-[#89b300] font-bold">
                        {formatRelativeTime(session.updated_at)}
                      </span>
                    </div>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="shrink-0 bg-white text-[#5C5C5C] border-[#E5E7EB] shadow-sm font-bold text-[8px] sm:text-[10px] uppercase tracking-wider px-2 sm:px-3 py-0.5 sm:py-1"
                >
                  En progreso
                </Badge>
              </div>

              {/* Progress Bar Header */}
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[#8C8C8C] font-semibold uppercase tracking-wide text-[10px] sm:text-xs">Progreso General</span>
                <span className="font-black text-[#0F0F0F] text-base sm:text-lg">{progressPercent}%</span>
              </div>

              {/* SaaS Progress Bar */}
              <div className="relative h-8 sm:h-10 w-full rounded-full p-1 bg-white border-2 border-[#E5E7EB]">
                 <div className="absolute inset-1 rounded-full bg-[repeating-linear-gradient(-45deg,#F5F6F7,#F5F6F7_10px,#FFFFFF_10px,#FFFFFF_20px)]" />
                 <div
                   className="relative h-full bg-[#D6F45B] rounded-full transition-all duration-1000 ease-in-out shadow-sm z-10"
                   style={{ width: `${progressPercent}%`, minWidth: progressPercent > 0 ? '1.5rem' : '0' }}
                 />
              </div>

              {/* Stats Pills */}
              <div className="grid grid-cols-3 gap-1.5 sm:gap-3 pt-2 sm:pt-3">
                <div className="flex flex-col justify-center gap-0.5 sm:gap-1 bg-[#F5F6F7] rounded-lg sm:rounded-xl px-2 sm:px-4 py-2 sm:py-3 border-2 border-transparent">
                  <div className="flex items-center gap-1">
                    <Check className="h-3 w-3 sm:h-4 sm:w-4 text-[#0F0F0F] stroke-[3]" />
                    <span className="text-sm sm:text-lg font-bold text-[#0F0F0F]">{completed}</span>
                  </div>
                  <p className="text-[8px] sm:text-[10px] font-bold text-[#5C5C5C] uppercase tracking-wider">Completados</p>
                </div>
                <div className="flex flex-col justify-center gap-0.5 sm:gap-1 bg-[#FFF0F0] rounded-lg sm:rounded-xl px-2 sm:px-4 py-2 sm:py-3 border-2 border-transparent">
                  <div className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4 text-[#FF4D4D] stroke-[3]" />
                    <span className="text-sm sm:text-lg font-bold text-[#FF4D4D]">{errors}</span>
                  </div>
                  <p className="text-[8px] sm:text-[10px] font-bold text-[#FF4D4D] uppercase tracking-wider">Errores</p>
                </div>
                <div className="flex flex-col justify-center gap-0.5 sm:gap-1 bg-[#F5F6F7] rounded-lg sm:rounded-xl px-2 sm:px-4 py-2 sm:py-3 border-2 border-[#E5E7EB]">
                  <div className="flex items-center gap-1">
                    <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 text-[#8C8C8C] stroke-[3]" />
                    <span className="text-sm sm:text-lg font-bold text-[#0F0F0F]">{pending}</span>
                  </div>
                  <p className="text-[8px] sm:text-[10px] font-bold text-[#8C8C8C] uppercase tracking-wider">Pendientes</p>
                </div>
              </div>
            </div>

            {/* Message */}
            <p className="text-[13px] sm:text-[15px] text-[#5C5C5C] text-center font-medium px-1 sm:px-4">
              Tu proceso de importación quedó en <strong className="text-[#0F0F0F] font-black">{completed} de {total}</strong> productos.
              ¿Quieres retomar el progreso donde lo dejaste?
            </p>
          </div>
        </div>

        {/* Actions - ALWAYS visible at bottom */}
        <div className="shrink-0 px-3 sm:px-6 py-3 sm:py-5 bg-[#F5F6F7] border-t border-[#E5E7EB] flex flex-col sm:flex-row items-stretch gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onAbandon}
            className="w-full min-w-0 sm:flex-1 inline-flex items-center justify-center rounded-xl border-2 border-[#FF4D4D] bg-white text-[#FF4D4D] hover:bg-[#FF4D4D] hover:text-white font-semibold text-[13px] sm:text-sm h-10 sm:h-10 transition-all outline-none focus:outline-none focus-visible:outline-none"
          >
            <Trash2 className="mr-1.5 h-4 w-4 shrink-0 stroke-[2.5]" />
            Abandonar
          </button>

          <button
            type="button"
            disabled={completed === 0}
            onClick={onDownloadPartial}
            className="w-full min-w-0 sm:flex-1 inline-flex items-center justify-center rounded-xl border-2 border-[#E5E7EB] bg-white text-[#0F0F0F] hover:bg-[#EBEBEB] font-semibold text-[13px] sm:text-sm h-10 sm:h-10 transition-all outline-none focus:outline-none focus-visible:outline-none disabled:opacity-50 disabled:pointer-events-none"
          >
            <Download className="mr-1.5 h-4 w-4 shrink-0 stroke-[2.5]" />
            CSV Parcial ({completed})
          </button>

          <button
            type="button"
            onClick={onRestore}
            className="w-full min-w-0 sm:flex-1 inline-flex items-center justify-center rounded-xl bg-[#0F0F0F] hover:bg-[#2A2A2A] text-white font-semibold text-[13px] sm:text-sm h-11 sm:h-10 transition-all outline-none focus:outline-none focus-visible:outline-none"
          >
            <RotateCcw className="mr-1.5 h-4 w-4 shrink-0 stroke-[2.5]" />
            Restaurar Sesión
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

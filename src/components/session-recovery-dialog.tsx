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
      <DialogContent className="sm:max-w-[520px] p-0 gap-0 overflow-hidden rounded-3xl">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-[#0F0F0F] via-[#1A1A1A] to-[#0F0F0F] px-6 py-5 text-white">
          <div className="flex items-center gap-3 mb-1">
            <div className="bg-white/20 rounded-full p-2">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg text-white font-semibold">
                Sesión Anterior Detectada
              </DialogTitle>
              <DialogDescription className="text-[#D6F45B] 100 text-sm mt-0.5">
                Encontramos una sesión de trabajo sin completar
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Session Info Card */}
        <div className="px-6 py-5 space-y-4">
          {/* File Info */}
          <div className="bg-[#F5F6F7] rounded-2xl border border-[#EBEBEB] p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <FileSpreadsheet className="h-5 w-5 text-[#D6F45B] 600 shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate" title={session.file_name}>
                    {session.file_name}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-[#8C8C8C] mt-0.5">
                    <Clock className="h-3 w-3" />
                    <span>{formatDate(session.created_at)}</span>
                    <span className="text-[#8C8C8C]/50">•</span>
                    <span className="text-[#D6F45B] font-medium">
                      Última actividad {formatRelativeTime(session.updated_at)}
                    </span>
                  </div>
                </div>
              </div>
              <Badge 
                variant="outline" 
                className="shrink-0 bg-amber-50 text-amber-700 border-amber-200 text-[10px]"
              >
                En progreso
              </Badge>
            </div>

            {/* Progress Bar Header */}
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-[#8C8C8C] font-semibold">Progreso</span>
              <span className="font-bold text-[#0F0F0F] text-sm">{progressPercent}%</span>
            </div>
            
            {/* SaaS Progress Bar */}
            <div className="relative h-6 w-full bg-[#EBEBEB] rounded-full overflow-hidden">
               <div 
                 className="absolute top-0 left-0 h-full bg-[#D6F45B] rounded-full transition-all duration-1000 ease-in-out" 
                 style={{ width: `${progressPercent}%` }} 
               />
            </div>

            {/* Stats Pills */}
            <div className="grid grid-cols-3 gap-3 pt-3">
              <div className="flex flex-col justify-center gap-1 bg-[#F5F6F7] rounded-3xl px-4 py-3 border-2 border-transparent">
                <div className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-[#0F0F0F] stroke-[3]" />
                  <span className="text-lg font-bold text-[#0F0F0F]">{completed}</span>
                </div>
                <p className="text-[10px] font-bold text-[#5C5C5C] uppercase tracking-wider">Completados</p>
              </div>
              <div className="flex flex-col justify-center gap-1 bg-[#FFF0F0] rounded-3xl px-4 py-3 border-2 border-transparent">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-[#FF4D4D] stroke-[3]" />
                  <span className="text-lg font-bold text-[#FF4D4D]">{errors}</span>
                </div>
                <p className="text-[10px] font-bold text-[#FF4D4D] uppercase tracking-wider">Errores</p>
              </div>
              <div className="flex flex-col justify-center gap-1 bg-[#F5F6F7] rounded-3xl px-4 py-3 border-2 border-[#EBEBEB]">
                <div className="flex items-center gap-1.5">
                  <Loader2 className="h-4 w-4 text-[#8C8C8C] stroke-[3]" />
                  <span className="text-lg font-bold text-[#0F0F0F]">{pending}</span>
                </div>
                <p className="text-[10px] font-bold text-[#8C8C8C] uppercase tracking-wider">Pendientes</p>
              </div>
            </div>
          </div>

          {/* Message */}
          <p className="text-sm text-[#8C8C8C] text-center mt-6">
            Tu último proceso quedó en <strong className="text-[#0F0F0F]">{completed} de {total}</strong> productos. 
            ¿Quieres retomar donde lo dejaste?
          </p>
        </div>

        {/* Actions - Thick SaaS Pills layout */}
        <div className="px-6 py-5 bg-[#F5F6F7] border-t border-[#EBEBEB] flex flex-col sm:flex-row items-center justify-between gap-3">
          <Button
            variant="outline"
            className="w-full sm:flex-1 rounded-full border-2 border-[#FF4D4D] text-[#FF4D4D] hover:bg-[#FF4D4D] hover:text-white font-bold h-11 transition-all"
            onClick={onAbandon}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Abandonar
          </Button>

          <Button
            variant="outline"
            disabled={completed === 0}
            onClick={onDownloadPartial}
            className="w-full sm:flex-1 rounded-full border-2 border-[#EBEBEB] text-[#0F0F0F] bg-white hover:bg-[#EBEBEB] font-bold h-11 transition-all"
          >
            <Download className="h-4 w-4 mr-2" />
            CSV Parcial ({completed})
          </Button>

          <Button
            onClick={onRestore}
            className="w-full sm:flex-1 rounded-full bg-[#D6F45B] hover:bg-[#c4df53] text-[#0F0F0F] font-bold h-11 shadow-sm transition-transform active:scale-95"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Restaurar Sesión
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

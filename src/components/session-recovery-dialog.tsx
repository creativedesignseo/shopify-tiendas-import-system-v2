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

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#8C8C8C]">Progreso</span>
                <span className="font-semibold text-[#1A1A1A]">{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-2.5" />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="flex items-center gap-1.5 bg-green-50 rounded-lg px-2.5 py-1.5 border border-green-100">
                <Check className="h-3.5 w-3.5 text-green-600" />
                <div>
                  <p className="text-xs font-bold text-green-700">{completed}</p>
                  <p className="text-[10px] text-green-600">Completados</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 bg-red-50 rounded-lg px-2.5 py-1.5 border border-red-100">
                <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                <div>
                  <p className="text-xs font-bold text-red-700">{errors}</p>
                  <p className="text-[10px] text-red-600">Errores</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg px-2.5 py-1.5 border border-slate-200">
                <Loader2 className="h-3.5 w-3.5 text-slate-500" />
                <div>
                  <p className="text-xs font-bold text-slate-700">{pending}</p>
                  <p className="text-[10px] text-slate-500">Pendientes</p>
                </div>
              </div>
            </div>
          </div>

          {/* Message */}
          <p className="text-sm text-[#8C8C8C] text-center">
            Tu último proceso quedó en <strong>{completed} de {total}</strong> productos. 
            ¿Quieres retomar donde lo dejaste?
          </p>
        </div>

        {/* Actions */}
        <DialogFooter className="px-6 py-4 bg-[#F5F6F7] border-t border-[#EBEBEB] gap-2 sm:gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onAbandon}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Abandonar
          </Button>
          <div className="flex-1" />
          {completed > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDownloadPartial}
              className="border-[#EBEBEB] text-[#1A1A1A] hover:bg-[#F5F6F7]"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              CSV Parcial ({completed})
            </Button>
          )}
          <Button
            size="sm"
            onClick={onRestore}
            className="bg-[#D6F45B] hover:brightness-95 text-[#0F0F0F] shadow-md px-5 font-semibold"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Restaurar Sesión
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

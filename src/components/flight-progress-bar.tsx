"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ImportSession } from "@/lib/backup-service"
import { ProcessedProduct } from "@/lib/product-processor"
import { Loader2, Download, Check, AlertCircle, Save, Clock } from "lucide-react"

interface SessionProgressBarProps {
  session: ImportSession | null
  products: ProcessedProduct[]
  lastSavedAt: Date | null
  isSaving: boolean
  onDownloadPartial: () => void
}

function formatRelativeTime(date: Date | null): string {
  if (!date) return "nunca"
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffMs / 60000)

  if (diffSecs < 10) return "ahora"
  if (diffSecs < 60) return `hace ${diffSecs}s`
  if (diffMins < 60) return `hace ${diffMins} min`
  return `hace ${Math.floor(diffMins / 60)}h`
}

export function FlightProgressBar({
  session,
  products,
  lastSavedAt,
  isSaving,
  onDownloadPartial,
}: SessionProgressBarProps) {
  const [, forceUpdate] = React.useState(0)

  // Update relative time every 30s
  React.useEffect(() => {
    const interval = setInterval(() => forceUpdate(n => n + 1), 30000)
    return () => clearInterval(interval)
  }, [])

  if (!session || products.length === 0) return null

  const completed = products.filter(p => p.status === "complete").length
  const errors = products.filter(p => p.status === "error").length
  const total = products.length
  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0
  const allDone = completed + errors === total

  return (
    <div className="bg-white rounded-3xl shadow-[0_10px_30px_rgba(0,0,0,0.05)] px-5 py-3.5 space-y-2">
      {/* Top Row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`rounded-full p-1.5 ${allDone ? 'bg-green-100' : 'bg-[#D6F45B]/20'}`}>
            {allDone ? (
              <Check className="h-3.5 w-3.5 text-green-600" />
            ) : (
              <Loader2 className="h-3.5 w-3.5 text-[#0F0F0F] animate-spin" />
            )}
          </div>
          <div className="flex items-center gap-2 text-sm min-w-0">
            <span className="font-semibold truncate max-w-[200px]" title={session.file_name}>
              {session.file_name}
            </span>
            <span className="text-[#8C8C8C]">•</span>
            <span className="font-medium text-[#1A1A1A]">{progressPercent}%</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Save status */}
          <div className="flex items-center gap-1 text-xs text-[#8C8C8C]">
            {isSaving ? (
              <>
                <Save className="h-3 w-3 animate-pulse text-[#D6F45B]" />
                <span className="text-[#1A1A1A]">Guardando...</span>
              </>
            ) : (
              <>
                <Clock className="h-3 w-3" />
                <span>{formatRelativeTime(lastSavedAt)}</span>
              </>
            )}
          </div>

          {/* Partial download */}
          {completed > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDownloadPartial}
              className="h-7 px-2.5 text-xs border-[#EBEBEB] text-[#1A1A1A] hover:bg-[#F5F6F7] rounded-full"
            >
              <Download className="mr-1 h-3 w-3" />
              CSV ({completed})
            </Button>
          )}
        </div>
      </div>

      {/* SaaS Progress Bar - Thick with striped empty space */}
      <div className="flex items-center gap-4 mt-2">
        <div className="relative h-10 flex-1 rounded-full p-1 bg-white border-2 border-[#EBEBEB]">
           {/* Zebra striped background representing the empty portion */}
           <div className="absolute inset-1 rounded-full bg-[repeating-linear-gradient(-45deg,#F5F6F7,#F5F6F7_10px,#FFFFFF_10px,#FFFFFF_20px)]" />
           
           {/* Actual Progress Fill */}
           <div 
             className="relative h-full bg-[#D6F45B] rounded-full transition-all duration-1000 ease-in-out shadow-sm z-10" 
             style={{ width: `${progressPercent}%`, minWidth: progressPercent > 0 ? '1.5rem' : '0' }} 
           />
        </div>

        <div className="flex flex-col items-end justify-center shrink-0">
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="max-h-12 px-2.5 py-1 bg-green-50 text-green-700 border-green-200 text-xs font-bold rounded-[0.7rem] shadow-sm">
              <Check className="mr-1 h-3.5 w-3.5 stroke-[3]" />
              {completed}
            </Badge>
            {errors > 0 && (
              <Badge variant="outline" className="max-h-12 px-2.5 py-1 bg-red-50 text-red-600 border-red-200 text-xs font-bold rounded-[0.7rem] shadow-sm">
                <AlertCircle className="mr-1 h-3.5 w-3.5 stroke-[3]" />
                {errors}
              </Badge>
            )}
            <span className="text-[#8C8C8C] text-xs font-bold ml-1">
              / {total}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

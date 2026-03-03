"use client"

import * as React from "react"
import { UploadCloud } from "lucide-react"

import { cn } from "@/lib/utils"

interface FileDropzoneProps extends React.HTMLAttributes<HTMLDivElement> {
  onFileSelect: (file: File) => void
  accept?: string
  label?: string
  description?: string
  disabled?: boolean
}

export function FileDropzone({
  onFileSelect,
  accept,
  label = "Subir archivo",
  description = "Arrastra y suelta o haz clic para subir",
  disabled = false,
  className,
  ...props
}: FileDropzoneProps) {
  const [isDragActive, setIsDragActive] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) setIsDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)

    if (disabled) return

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      onFileSelect(files[0])
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      onFileSelect(files[0])
    }
  }

  const handleClick = () => {
    if (!disabled && inputRef.current) {
      inputRef.current.click()
    }
  }

  return (
    <div
      onClick={handleClick}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={cn(
        "group flex flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-12 transition-all duration-300 ease-in-out bg-white",
        isDragActive
          ? "border-[#D6F45B] bg-[#D6F45B]/5 shadow-[0_0_0_4px_rgba(214,244,91,0.15)]"
          : "border-[#EBEBEB] hover:border-[#D6F45B]/50 hover:shadow-[0_10px_30px_rgba(0,0,0,0.05)]",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer active:scale-[0.99]",
        className
      )}
      {...props}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />
      <div className="flex flex-col items-center justify-center gap-3 text-center text-[#8C8C8C] transition-all duration-300 group-hover:text-[#1A1A1A]">
        <div className="rounded-2xl bg-[#F5F6F7] p-4 transition-all duration-300 group-hover:bg-[#D6F45B]/10 group-hover:scale-110">
          <UploadCloud className="h-8 w-8 transition-all duration-300" />
        </div>
        <div className="text-base font-semibold tracking-tight leading-none">{label}</div>
        <div className="text-xs font-medium opacity-60 group-hover:opacity-100">{description}</div>
      </div>
    </div>
  )
}

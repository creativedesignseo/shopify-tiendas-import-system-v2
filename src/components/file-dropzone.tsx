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
        "group flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 transition-all duration-300 ease-in-out",
        isDragActive
          ? "border-primary bg-primary/10 shadow-inner"
          : "border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/5 hover:shadow-md",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer active:scale-[0.98]",
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
      <div className="flex flex-col items-center justify-center gap-2 text-center text-muted-foreground transition-all duration-300 group-hover:text-primary">
        <UploadCloud className="h-10 w-10 transition-all duration-300 group-hover:scale-110 group-hover:-translate-y-1 group-hover:rotate-3" />
        <div className="text-lg font-semibold tracking-tight leading-none mt-1">{label}</div>
        <div className="text-xs font-medium opacity-60 group-hover:opacity-100">{description}</div>
      </div>
    </div>
  )
}

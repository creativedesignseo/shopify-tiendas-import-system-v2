"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Sparkles, FileText } from "lucide-react"
import { cn } from "@/lib/utils"

export function MainNav() {
  const pathname = usePathname()

  return (
    <div className="border-b bg-white">
      <div className="container mx-auto px-8">
        <div className="flex h-14 items-center gap-6">
          <Link 
            href="/" 
            className={cn(
              "flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary",
              pathname === "/" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
            )}
          >
            <Sparkles className="h-4 w-4" />
            Optimizador IA (CSV)
          </Link>
          <Link 
            href="/mayorista" 
            className={cn(
              "flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary",
              pathname === "/mayorista" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
            )}
          >
            <FileText className="h-4 w-4" />
            Catálogo Mayorista (PDF)
          </Link>
        </div>
      </div>
    </div>
  )
}

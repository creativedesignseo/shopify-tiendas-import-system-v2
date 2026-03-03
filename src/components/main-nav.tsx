"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Sparkles, FileText } from "lucide-react"
import { cn } from "@/lib/utils"

export function MainNav() {
  const pathname = usePathname()

  return (
    <div className="bg-[#0F0F0F]">
      <div className="container mx-auto px-8">
        <div className="flex h-14 items-center gap-8">
          <Link 
            href="/" 
            className={cn(
              "flex items-center gap-2 text-sm font-medium transition-all duration-250",
              pathname === "/" 
                ? "text-[#D6F45B]" 
                : "text-white/60 hover:text-white"
            )}
          >
            <Sparkles className="h-4 w-4" />
            Optimizador IA (CSV)
          </Link>
          <Link 
            href="/mayorista" 
            className={cn(
              "flex items-center gap-2 text-sm font-medium transition-all duration-250",
              pathname === "/mayorista" 
                ? "text-[#D6F45B]" 
                : "text-white/60 hover:text-white"
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

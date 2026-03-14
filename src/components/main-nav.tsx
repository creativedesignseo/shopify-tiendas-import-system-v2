"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Sparkles, FileText } from "lucide-react"
import { cn } from "@/lib/utils"

export function MainNav() {
  const pathname = usePathname()

  const linkClass = (active: boolean) => cn(
    "flex items-center gap-2 text-[13px] font-medium h-full border-b-2 px-1 transition-colors duration-200",
    active
      ? "text-[#D6F45B] border-[#D6F45B]"
      : "text-white/50 border-transparent hover:text-white/80"
  )

  return (
    <div className="bg-[#0F0F0F]">
      <div className="max-w-6xl mx-auto px-8">
        <div className="flex h-12 items-center gap-8">
          <Link href="/" className={linkClass(pathname === "/")}>
            <Sparkles className="h-3.5 w-3.5" />
            Importador IA
          </Link>
          <Link href="/mayorista" className={linkClass(pathname === "/mayorista")}>
            <FileText className="h-3.5 w-3.5" />
            Catálogo Mayorista
          </Link>
        </div>
      </div>
    </div>
  )
}

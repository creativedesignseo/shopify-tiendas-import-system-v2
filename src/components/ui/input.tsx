import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-2xl border border-[#EBEBEB] bg-white px-4 py-2.5 text-sm text-[#1A1A1A] file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[#8C8C8C] focus-visible:outline-none focus:border-[#D6F45B] focus:shadow-[0_0_0_3px_rgba(214,244,91,0.15)] disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-250",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }

# Manual Product Entry + UI Polish — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add manual product entry (name + brand → AI does the rest) and polish the entire UI to feel premium and cohesive while keeping the existing color palette.

**Architecture:** The Step 2 card gets a segmented control to toggle between CSV upload and manual entry. A new `ManualProductForm` component handles form state, validation, and `ProcessedProduct` creation. All existing UI components get visual polish (radii, shadows, spacing) without changing functionality.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, Radix UI, Lucide icons. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-03-14-manual-entry-ui-polish-design.md`

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/app/globals.css` | CSS design tokens, focus rings, scrollbar | Modify |
| `src/components/ui/button.tsx` | Button variants (radius, sizes) | Modify |
| `src/components/ui/card.tsx` | Card radius and shadow | Modify |
| `src/components/ui/input.tsx` | Input radius and focus styles | Modify |
| `src/components/ui/badge.tsx` | Badge styling | Modify |
| `src/components/main-nav.tsx` | Top navigation bar | Modify |
| `src/components/file-dropzone.tsx` | File upload dropzone | Modify |
| `src/lib/utils.ts` | Shared utilities (add generateUUID) | Modify |
| `src/components/manual-product-form.tsx` | Manual product entry form | **Create** |
| `src/app/page.tsx` | Main dashboard (layout, Step 2 card, manual mode) | Modify |
| `src/components/products-table.tsx` | Product table + mobile cards | Modify |
| `src/components/flight-progress-bar.tsx` | Session progress bar | Modify |
| `src/components/settings-dialog.tsx` | Settings modal | Modify |
| `src/components/session-recovery-dialog.tsx` | Session recovery modal | Modify |
| `src/components/product-review-dialog.tsx` | Product review/AI modal | Modify |

---

## Chunk 1: Foundation — CSS Tokens + Base UI Components

### Task 1: Update CSS design tokens

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Update CSS variables and focus styles**

Replace the contents of `globals.css` with refined tokens. Key changes:
- `--radius: 1rem` (down from `1.5rem` — less bubbly)
- `--shadow-card: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)` (subtler)
- `--shadow-float: 0 10px 25px rgba(0,0,0,0.06)` (subtler)
- Focus ring: `box-shadow: 0 0 0 2px rgba(214,244,91,0.2)` (less aggressive)
- Remove the global `transition-property` on `*` selector (causes unwanted animation on layout)
- Keep interactive elements transition at `200ms`

```css
@import "tailwindcss";

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-inter);
  --font-mono: var(--font-geist-mono);

  --radius-lg: var(--radius);
  --radius-md: calc(var(--radius) - 4px);
  --radius-sm: calc(var(--radius) - 8px);
}

:root {
  --background: #FAFAFA;
  --foreground: #1A1A1A;

  --card: #ffffff;
  --card-foreground: #1A1A1A;

  --popover: #ffffff;
  --popover-foreground: #1A1A1A;

  --primary: #D6F45B;
  --primary-foreground: #0F0F0F;

  --secondary: #F0F0F0;
  --secondary-foreground: #1A1A1A;

  --muted: #F0F0F0;
  --muted-foreground: #8C8C8C;

  --accent: #D6F45B;
  --accent-foreground: #0F0F0F;

  --destructive: #ef4444;
  --destructive-foreground: #ffffff;

  --border: #E5E7EB;
  --input: #E5E7EB;
  --ring: #D6F45B;

  --radius: 1rem;

  --dark-base: #0F0F0F;
  --dark-text: #ffffff;

  --shadow-card: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06);
  --shadow-float: 0 10px 25px rgba(0,0,0,0.06);
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.overflow-x-auto {
  -webkit-overflow-scrolling: touch;
}

table {
  width: 100%;
  border-collapse: collapse;
}

button, a, input, select, textarea, [role="button"], [tabindex] {
  transition: background-color 200ms ease, border-color 200ms ease, color 200ms ease, box-shadow 200ms ease, opacity 200ms ease, transform 200ms ease;
}

@media (min-width: 768px) {
  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 10px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
  }
}

.card-elevated {
  background: var(--card);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
}

*:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

input:focus, textarea:focus, select:focus {
  border-color: var(--ring) !important;
  box-shadow: 0 0 0 2px rgba(214, 244, 91, 0.2) !important;
  outline: none;
}
```

- [ ] **Step 2: Verify the app still loads**

Run: `npm run dev` and open `http://localhost:3000`
Expected: App loads without errors, slightly refined visual tokens visible.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "style: refine CSS design tokens for premium SaaS look"
```

---

### Task 2: Polish base UI components (button, card, input, badge)

**Files:**
- Modify: `src/components/ui/button.tsx`
- Modify: `src/components/ui/card.tsx`
- Modify: `src/components/ui/input.tsx`
- Modify: `src/components/ui/badge.tsx`

- [ ] **Step 1: Update button.tsx — radius and variants**

Change `rounded-full` to `rounded-xl` in the base cva string. Adjust variant styles:

```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-[#D6F45B] text-[#0F0F0F] hover:brightness-[0.97] active:scale-[0.98] shadow-sm",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-[#E5E7EB] bg-white text-[#1A1A1A] hover:bg-[#F5F6F7]",
        secondary:
          "bg-[#F0F0F0] text-[#1A1A1A] hover:bg-[#E5E5E5]",
        ghost: "hover:bg-[#F0F0F0] text-[#1A1A1A]",
        link: "text-[#1A1A1A] underline-offset-4 hover:underline",
        pill: "bg-[#F0F0F0] text-[#1A1A1A] hover:bg-[#E5E5E5] rounded-full px-6",
      },
      size: {
        default: "h-10 px-5 py-2 text-sm",
        sm: "h-8 px-3.5 text-xs",
        lg: "h-12 px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
```

- [ ] **Step 2: Update card.tsx — radius and shadow**

Change Card base className:

```tsx
// Change from:
"rounded-3xl bg-card text-card-foreground shadow-[0_10px_30px_rgba(0,0,0,0.05)]"
// To:
"rounded-2xl border border-[#E5E7EB] bg-card text-card-foreground shadow-[var(--shadow-card)]"
```

- [ ] **Step 3: Update input.tsx — radius and focus**

Change Input base className:

```tsx
// Change from:
"flex h-11 w-full rounded-2xl border border-[#EBEBEB] bg-white px-4 py-2.5 text-sm text-[#1A1A1A] ... focus:border-[#D6F45B] focus:shadow-[0_0_0_3px_rgba(214,244,91,0.15)] ..."
// To:
"flex h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm text-[#1A1A1A] file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[#8C8C8C] focus-visible:outline-none focus:border-[#D6F45B] focus:shadow-[0_0_0_2px_rgba(214,244,91,0.2)] disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200"
```

- [ ] **Step 4: Update badge.tsx — refined variants**

Replace the badge base cva with slightly cleaner spacing:

```tsx
const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground border-[#E5E7EB]",
        success: "border-transparent bg-emerald-50 text-emerald-700",
        warning: "border-transparent bg-amber-50 text-amber-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)
```

Note: `success` and `warning` changed from solid bg to soft bg (emerald-50, amber-50) for a more premium look.

- [ ] **Step 5: Verify app loads and components render correctly**

Run: `npm run dev` and check:
- Buttons are `rounded-xl` (not full circles)
- Cards have subtle border + shadow
- Inputs are slightly smaller height
- No visual regressions

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/button.tsx src/components/ui/card.tsx src/components/ui/input.tsx src/components/ui/badge.tsx
git commit -m "style: polish base UI components (button, card, input, badge)"
```

---

## Chunk 2: Component Polish — Navbar, Dropzone, Table, Dialogs

### Task 3: Polish navbar

**Files:**
- Modify: `src/components/main-nav.tsx`

- [ ] **Step 1: Refine navbar styles**

Update the MainNav component. Key changes:
- Height from `h-14` to `h-12` (slimmer)
- Font size `text-[13px]` (tighter)
- Active indicator: bottom border instead of color change

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/main-nav.tsx
git commit -m "style: polish navbar with slimmer design and active indicator"
```

---

### Task 4: Polish file dropzone

**Files:**
- Modify: `src/components/file-dropzone.tsx`

- [ ] **Step 1: Refine dropzone styles**

Key changes:
- Radius from `rounded-3xl` to `rounded-2xl`
- Border from `border-[#EBEBEB]` to `border-[#E5E7EB]`
- Less padding: `px-6 py-8` instead of `px-6 py-12`
- Icon container from `rounded-2xl` to `rounded-xl`
- Subtler hover shadow

Update the className in the main div:

```tsx
// Outer div className:
cn(
  "group flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 transition-all duration-200 bg-white",
  isDragActive
    ? "border-[#D6F45B] bg-[#D6F45B]/5 shadow-[0_0_0_3px_rgba(214,244,91,0.1)]"
    : "border-[#E5E7EB] hover:border-[#D6F45B]/40 hover:shadow-sm",
  disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer active:scale-[0.99]",
  className
)

// Icon container className:
"rounded-xl bg-[#F5F6F7] p-3 transition-all duration-200 group-hover:bg-[#D6F45B]/10 group-hover:scale-105"

// Icon className:
"h-6 w-6 transition-all duration-200"

// Label className:
"text-sm font-semibold tracking-tight leading-none"

// Description className:
"text-xs font-medium opacity-50 group-hover:opacity-80"
```

- [ ] **Step 2: Commit**

```bash
git add src/components/file-dropzone.tsx
git commit -m "style: polish file dropzone with refined spacing and borders"
```

---

### Task 5: Polish products table

**Files:**
- Modify: `src/components/products-table.tsx`

- [ ] **Step 1: Update table header styling**

Change `TableHeader` row styling for a professional look. Update the following in the desktop table:

Table container: Change `rounded-2xl border border-[#EBEBEB]` to `rounded-xl border border-[#E5E7EB]`

Table headers: Add `uppercase tracking-wider text-[11px] font-medium text-[#8C8C8C]` to each `TableHead`.

- [ ] **Step 2: Update status badges**

Replace the badge JSX for each status with cleaner versions:

```tsx
// pending
<Badge variant="secondary" className="rounded-full text-[10px] px-2.5 py-0.5 font-medium">
  En cola
</Badge>

// generating
<Badge variant="outline" className="rounded-full text-[10px] px-2.5 py-0.5 font-medium border-[#D6F45B] text-[#1A1A1A]">
  <Loader2 className="h-3 w-3 animate-spin mr-1" /> Proc.
</Badge>

// complete
<Badge className="bg-[#D6F45B] text-[#0F0F0F] rounded-full text-[10px] px-2.5 py-0.5 font-medium border-transparent hover:bg-[#D6F45B]" title={product.modelUsed ? `Generado con ${product.modelUsed}` : 'Listo'}>
  <Check className="h-3 w-3 mr-1" /> Listo
</Badge>

// error
<Badge variant="destructive" className="rounded-full text-[10px] px-2.5 py-0.5 font-medium" title={product.errorDetails || 'Error'}>
  <AlertCircle className="h-3 w-3 mr-1" /> Error
</Badge>
```

- [ ] **Step 3: Update row hover and spacing**

Row className update:
```tsx
cn(
  "transition-colors",
  product.isChecked ? "hover:bg-[#FAFAFA]" : "bg-[#F5F6F7]/50 opacity-70"
)
```

- [ ] **Step 4: Update mobile card view**

For the mobile card view, update border radius from `rounded-xl` to `rounded-2xl`, and ensure buttons use `rounded-xl` instead of `rounded-full`.

- [ ] **Step 5: Verify table renders correctly**

Run dev server, upload a CSV, check:
- Table headers are uppercase, smaller, gray
- Badges are compact
- Row hover is subtle
- Mobile view looks clean

- [ ] **Step 6: Commit**

```bash
git add src/components/products-table.tsx
git commit -m "style: polish products table with refined headers, badges, and spacing"
```

---

### Task 6: Polish dialogs (settings, session recovery, flight progress bar)

**Files:**
- Modify: `src/components/settings-dialog.tsx`
- Modify: `src/components/session-recovery-dialog.tsx`
- Modify: `src/components/flight-progress-bar.tsx`

- [ ] **Step 1: Polish settings dialog**

Key changes in `settings-dialog.tsx`:
- `DialogContent` className: change `rounded-3xl` to `rounded-2xl`
- Select elements: change `rounded-2xl` to `rounded-xl`, `h-11` to `h-10`, border `#EBEBEB` to `#E5E7EB`
- Button trigger: change `rounded-full` to `rounded-xl`

- [ ] **Step 2: Polish session recovery dialog**

Key changes in `session-recovery-dialog.tsx`:
- `DialogContent`: change `rounded-[2rem]` to `rounded-2xl`
- Stats pills: change `rounded-3xl` to `rounded-xl`
- Progress bar container: change `rounded-3xl` to `rounded-xl`, border `#EBEBEB` to `#E5E7EB`
- Action buttons: change `rounded-full` to `rounded-xl`, reduce `h-12` to `h-10`, `font-extrabold` to `font-semibold`

- [ ] **Step 3: Polish flight progress bar**

Key changes in `flight-progress-bar.tsx`:
- Outer container: change `rounded-3xl` to `rounded-2xl`, shadow to `shadow-[var(--shadow-card)]`
- Progress bar: change inner container `rounded-full` to keep (it's a bar, full is correct), border `#EBEBEB` to `#E5E7EB`
- Download button: change `rounded-full` to `rounded-lg`
- Badge: update `rounded-[0.7rem]` to `rounded-lg`

- [ ] **Step 4: Commit**

```bash
git add src/components/settings-dialog.tsx src/components/session-recovery-dialog.tsx src/components/flight-progress-bar.tsx
git commit -m "style: polish dialogs and progress bar for cohesive look"
```

---

### Task 7: Polish product review dialog

**Files:**
- Modify: `src/components/product-review-dialog.tsx`

- [ ] **Step 1: Update dialog container and inner elements**

This is a large file. Focus on these targeted changes:
- `DialogContent`: change any `rounded-3xl` to `rounded-2xl`
- Any inner `rounded-3xl` containers to `rounded-xl`
- Any `rounded-full` buttons to `rounded-xl` (except icon-only buttons)
- Border colors: `#EBEBEB` → `#E5E7EB`
- Any `h-11` inputs/buttons to `h-10`
- Any `font-extrabold` to `font-semibold`

Do NOT change the layout or logic — only CSS class values.

- [ ] **Step 2: Commit**

```bash
git add src/components/product-review-dialog.tsx
git commit -m "style: polish product review dialog"
```

---

## Chunk 3: Feature — Manual Product Entry + Dashboard Polish

### Task 8: Extract generateUUID to shared utility

**Files:**
- Modify: `src/lib/utils.ts`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add generateUUID to utils.ts**

Add this function to the end of `src/lib/utils.ts`:

```ts
export function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}
```

- [ ] **Step 2: Update page.tsx to import from utils**

In `src/app/page.tsx`:
- Remove the local `generateUUID` function (lines 26-34)
- Add `generateUUID` to the existing import from `@/lib/utils`:

```tsx
import { cn, generateUUID } from "@/lib/utils"
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/utils.ts src/app/page.tsx
git commit -m "refactor: extract generateUUID to shared utils"
```

---

### Task 9: Create ManualProductForm component (continued)

**Files:**
- Create: `src/components/manual-product-form.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Plus, AlertTriangle } from "lucide-react"
import { ProcessedProduct, calculateUnitPrice } from "@/lib/product-processor"
import { MasterData } from "@/lib/csv-parser"
import { sanitizeBarcode } from "@/lib/barcode-utils"
import { generateUUID } from "@/lib/utils"

interface ManualProductFormProps {
  masterData: MasterData
  existingProducts: ProcessedProduct[]
  onAddProduct: (product: ProcessedProduct) => void
}

export function ManualProductForm({ masterData, existingProducts, onAddProduct }: ManualProductFormProps) {
  const nameRef = React.useRef<HTMLInputElement>(null)
  const [nombre, setNombre] = React.useState("")
  const [marca, setMarca] = React.useState("")
  const [precio, setPrecio] = React.useState("")
  const [tamano, setTamano] = React.useState("")
  const [barcode, setBarcode] = React.useState("")

  const [barcodeError, setBarcodeError] = React.useState("")
  const [titleWarning, setTitleWarning] = React.useState("")

  const canAdd = nombre.trim() !== "" && marca.trim() !== "" && !barcodeError

  // Validate barcode on change
  React.useEffect(() => {
    setBarcodeError("")
    if (!barcode.trim()) return

    const sanitized = sanitizeBarcode(barcode.trim())
    if (!sanitized) return

    const inMaster = masterData.existingBarcodes.has(sanitized)
    const inProducts = existingProducts.some(p => p.barcode === sanitized)

    if (inMaster || inProducts) {
      setBarcodeError("Este código de barras ya existe")
    }
  }, [barcode, masterData, existingProducts])

  // Validate title on change
  React.useEffect(() => {
    setTitleWarning("")
    const normalized = nombre.trim().toLowerCase()
    if (!normalized) return

    const inMaster = masterData.existingTitles.has(normalized)
    const inProducts = existingProducts.some(p => p.title.trim().toLowerCase() === normalized)

    if (inMaster || inProducts) {
      setTitleWarning("Ya existe un producto con este nombre")
    }
  }, [nombre, masterData, existingProducts])

  const handleAdd = () => {
    if (!canAdd) return

    const sanitizedBarcode = barcode.trim() ? sanitizeBarcode(barcode.trim()) : ""
    const id = sanitizedBarcode || generateUUID()
    const unitPriceCalc = calculateUnitPrice(tamano || "")

    const product: ProcessedProduct = {
      id,
      title: nombre.trim(),
      vendor: marca.trim(),
      price: precio.trim(),
      barcode: sanitizedBarcode,
      size: tamano.trim(),

      generatedTitle: nombre.trim(),
      bodyHtml: "",
      tags: "",
      images: [],
      seoTitle: "",
      seoDescription: "",

      metafields: {
        acorde: "",
        genero: "",
        notas_salida: "",
        ocasion: "",
        estacion: "",
        aroma: "",
        sexo_objetivo: "",
      },

      unitPrice: unitPriceCalc,
      isDuplicate: false,
      isChecked: true,
      status: "pending",
    }

    onAddProduct(product)

    // Reset form
    setNombre("")
    setMarca("")
    setPrecio("")
    setTamano("")
    setBarcode("")
    setBarcodeError("")
    setTitleWarning("")

    // Focus back to nombre
    nameRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && canAdd) {
      e.preventDefault()
      handleAdd()
    }
  }

  return (
    <div className="space-y-4" onKeyDown={handleKeyDown}>
      {/* Row 1: Nombre + Marca */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="manual-nombre" className="text-xs font-medium text-[#8C8C8C] uppercase tracking-wider">
            Nombre *
          </Label>
          <Input
            ref={nameRef}
            id="manual-nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Sauvage Eau de Parfum"
            autoComplete="off"
          />
          {titleWarning && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {titleWarning}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="manual-marca" className="text-xs font-medium text-[#8C8C8C] uppercase tracking-wider">
            Marca *
          </Label>
          <Input
            id="manual-marca"
            value={marca}
            onChange={(e) => setMarca(e.target.value)}
            placeholder="Ej: Dior"
            autoComplete="off"
          />
        </div>
      </div>

      {/* Row 2: Precio + Tamaño + Barcode */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="manual-precio" className="text-xs font-medium text-[#8C8C8C] uppercase tracking-wider">
            Precio (EUR)
          </Label>
          <Input
            id="manual-precio"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            placeholder="39.90"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="manual-tamano" className="text-xs font-medium text-[#8C8C8C] uppercase tracking-wider">
            Tamaño
          </Label>
          <Input
            id="manual-tamano"
            value={tamano}
            onChange={(e) => setTamano(e.target.value)}
            placeholder="100ml"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="manual-barcode" className="text-xs font-medium text-[#8C8C8C] uppercase tracking-wider">
            Código de barras
          </Label>
          <Input
            id="manual-barcode"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="3348901234567"
            autoComplete="off"
            className={barcodeError ? "border-red-400 focus:border-red-400" : ""}
          />
          {barcodeError && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {barcodeError}
            </p>
          )}
        </div>
      </div>

      {/* Add Button */}
      <Button
        onClick={handleAdd}
        disabled={!canAdd}
        className="w-full sm:w-auto"
      >
        <Plus className="h-4 w-4 mr-2" />
        Agregar a la tabla
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Verify component imports resolve**

Run: `npm run dev`
Expected: No import errors (the component isn't rendered yet but imports should resolve)

- [ ] **Step 3: Commit**

```bash
git add src/components/manual-product-form.tsx
git commit -m "feat: add ManualProductForm component for manual product entry"
```

---

### Task 9: Update dashboard — segmented control + manual mode + visual polish

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add manual mode state and handler**

Add these state variables after the existing state declarations in `Dashboard()`:

```tsx
// Manual Entry Mode
const [step2Mode, setStep2Mode] = React.useState<"csv" | "manual">("csv")
```

Add the `handleManualAdd` function after `handleNewFile`:

```tsx
// ─── 3. Agregar Producto Manual ─────────────────────────────────
const handleManualAdd = async (product: ProcessedProduct) => {
  const updatedProducts = [...products, product]
  setProducts(updatedProducts)

  // Create or update session
  if (!currentSession) {
    const session = await BackupService.createSession(
      deviceId,
      "manual-entry",
      updatedProducts.length
    )
    if (session) {
      setCurrentSession(session)
      console.log('📦 Manual entry session started:', session.id)
    }
  } else {
    setCurrentSession(prev => prev ? {
      ...prev,
      total_products: updatedProducts.length,
    } : null)
  }
}
```

- [ ] **Step 2: Add ManualProductForm import**

Add to the imports at top of file:

```tsx
import { ManualProductForm } from "@/components/manual-product-form"
```

- [ ] **Step 3: Update the Step 2 card with segmented control**

Replace the entire "Zona Nuevos Productos" Card (the second card in the grid) with:

```tsx
{/* Zona Nuevos Productos — CSV or Manual */}
<Card className={cn(
  "transition-all duration-200",
  !masterData ? "opacity-50 pointer-events-none" : ""
)}>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
       <UploadCloud className="h-5 w-5" />
       Paso 2: Nuevos Productos
    </CardTitle>
    <CardDescription>
      Añade productos desde un archivo CSV o insértalos manualmente.
    </CardDescription>
    {/* Segmented Control */}
    {masterData && (
      <div className="flex bg-[#F0F0F0] rounded-lg p-1 mt-3">
        <button
          onClick={() => setStep2Mode("csv")}
          className={cn(
            "flex-1 text-sm font-medium py-2 px-4 rounded-md transition-all duration-200",
            step2Mode === "csv"
              ? "bg-[#D6F45B] text-[#0F0F0F] shadow-sm"
              : "text-[#8C8C8C] hover:text-[#1A1A1A]"
          )}
        >
          Subir CSV
        </button>
        <button
          onClick={() => setStep2Mode("manual")}
          className={cn(
            "flex-1 text-sm font-medium py-2 px-4 rounded-md transition-all duration-200",
            step2Mode === "manual"
              ? "bg-[#D6F45B] text-[#0F0F0F] shadow-sm"
              : "text-[#8C8C8C] hover:text-[#1A1A1A]"
          )}
        >
          Manual
        </button>
      </div>
    )}
  </CardHeader>
  <CardContent>
    {step2Mode === "csv" ? (
      <FileDropzone
        onFileSelect={handleNewFile}
        accept=".csv"
        disabled={!masterData}
        label="Arrastra Nuevos Productos"
      />
    ) : (
      masterData && (
        <ManualProductForm
          masterData={masterData}
          existingProducts={products}
          onAddProduct={handleManualAdd}
        />
      )
    )}
  </CardContent>
</Card>
```

- [ ] **Step 4: Update both Step 1 and Step 2 card transitions to duration-200**

Ensure both cards in the grid use `transition-all duration-200` for consistency (the master card currently uses `duration-300`).

- [ ] **Step 5: Update page layout — max-width and spacing**

Change the main container:

```tsx
// From:
<main className="container mx-auto p-8 space-y-8 min-h-screen">
// To:
<main className="max-w-6xl mx-auto px-6 py-8 space-y-8 min-h-screen">
```

- [ ] **Step 6: Polish the header area buttons**

Update the "Limpiar Todo" button — remove `hover:bg-destructive/90` override, it should use the outline variant cleanly. Update the "Exportar" button to use consistent styling.

Change the header buttons:

```tsx
<Button
  variant="outline"
  onClick={handleClearAll}
  disabled={products.length === 0 && !masterData}
>
  <Trash2 className="mr-2 h-4 w-4" /> Limpiar Todo
</Button>
<Button
  onClick={handleExport}
  disabled={!products.some(p => p.status === "complete" && p.isChecked) || !masterData}
>
  <Download className="mr-2 h-4 w-4 shrink-0" />
  Exportar ({products.filter(p => p.status === "complete" && p.isChecked).length})
</Button>
```

- [ ] **Step 7: Polish the info banner**

Update the dark banner that shows "Utiliza el botón Revisar / IA...":

```tsx
// From:
<div className="bg-[#0F0F0F] rounded-2xl px-5 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.1)]">
// To:
<div className="bg-[#0F0F0F] rounded-xl px-5 py-3.5">
```

- [ ] **Step 8: Polish the preparation zone card header**

```tsx
// From:
<CardHeader className="pb-3 border-b border-[#EBEBEB] bg-[#F5F6F7]/50 rounded-t-3xl">
// To:
<CardHeader className="pb-3 border-b border-[#E5E7EB] bg-[#F5F6F7]/50 rounded-t-2xl">
```

And the badge inside:
```tsx
// From:
<div className="text-xs text-[#0F0F0F] bg-[#D6F45B] px-3 py-1 rounded-full font-semibold">
// To:
<div className="text-xs text-[#0F0F0F] bg-[#D6F45B] px-3 py-1 rounded-lg font-medium">
```

- [ ] **Step 9: Polish success dialog**

Update the success dialog:
```tsx
// DialogContent: change rounded-3xl to rounded-2xl
// Inner circle: change rounded-full sizing but keep shape
// Button: change rounded-full to rounded-xl
<DialogContent className="max-w-md rounded-2xl border-[#E5E7EB] text-center p-8 sm:p-10 [&>button]:hidden">
```

The continue button:
```tsx
<Button
  className="mt-6 w-full rounded-xl bg-[#0F0F0F] text-[#D6F45B] hover:bg-[#1A1A1A] py-5 text-base font-semibold shadow-sm"
  onClick={() => setShowSuccessDialog(false)}
>
  Continuar
</Button>
```

- [ ] **Step 10: Polish duplicates dialog**

```tsx
// DialogContent: change rounded-3xl to rounded-2xl
// Inner table border: change rounded-2xl to rounded-xl, border-[#EBEBEB] to border-[#E5E7EB]
```

- [ ] **Step 11: Verify the full flow**

Run: `npm run dev` and test:
1. Load master CSV → Step 1 card shows loaded state
2. Switch to "Manual" tab in Step 2
3. Enter nombre "Test Product" + marca "Test Brand"
4. Click "Agregar a la tabla" → product appears in table with "En cola" status
5. Enter another product → form clears, focus returns to nombre
6. Switch back to "Subir CSV" tab → dropzone appears
7. Test barcode duplicate detection
8. Verify the entire layout looks cohesive

- [ ] **Step 12: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add manual product entry with segmented control + polish dashboard"
```

---

## Chunk 4: Final Verification

### Task 10: Full verification pass

- [ ] **Step 1: Run build to catch type errors**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 2: Test complete flow end-to-end**

1. Open `http://localhost:3000`
2. Upload master CSV
3. Add product manually (nombre + marca only)
4. Add product manually (all fields)
5. Try adding duplicate barcode → error shown
6. Try adding duplicate title → warning shown
7. Upload CSV of new products (existing flow)
8. Verify both manual and CSV products appear in table
9. Click "Revisar / IA" on a manual product → AI generates content
10. Export → CSV downloads correctly

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address any issues from verification pass"
```

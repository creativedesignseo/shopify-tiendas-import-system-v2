# Manual Product Entry + UI Polish — Design Spec

**Date:** 2026-03-14
**Status:** Approved

---

## 1. Problem

The current product import flow requires uploading a CSV file for new products (Step 2). When the user only has one or two products with just a name and brand, they must manually create a CSV file, which is friction-heavy. Additionally, the overall UI needs visual polish to feel premium and cohesive while keeping the existing color palette (#0F0F0F, #D6F45B, #F5F6F7, #EBEBEB).

## 2. Solution

### 2.1 Manual Product Entry

Transform the "Step 2: New Products" card into a unified card with two modes controlled by a segmented control toggle:

- **Mode "Subir CSV"**: Shows the existing FileDropzone (current behavior, unchanged).
- **Mode "Manual"**: Shows an inline form with:
  - **Required fields**: Nombre (name), Marca (brand)
  - **Optional fields**: Precio (price), Tamano (size), Codigo de barras (barcode)
  - **Action button**: "Agregar a la tabla" — creates a `ProcessedProduct` with status `pending`, clears the form, returns focus to Nombre for chaining.

#### Prerequisites

- **masterData must be loaded** (Step 1 complete) before manual entry is available — same gate as CSV upload. The segmented control and form are disabled/grayed out if masterData is null.

#### Data Flow

1. User fills in Nombre + Marca (+ optional fields)
2. Click "Agregar" triggers:
   - Duplicate check against `masterData.existingBarcodes`, `masterData.existingTitles`, AND the current `products` state array (same as CSV's `seenBarcodesInFile`/`seenTitlesInFile` but checking the live products list)
   - Creates `ProcessedProduct` with same defaults as `processNewProducts`:
     - `id`: barcode (if provided) or generated UUID
     - `status`: "pending"
     - `isDuplicate`: false
     - `generatedTitle`: initialized to Nombre (matches CSV behavior)
     - `bodyHtml`: ""
     - `tags`: ""
     - `seoTitle`: ""
     - `seoDescription`: ""
     - `images`: []
     - `metafields`: all empty strings
     - `unitPrice`: calculated from size if provided, otherwise `isValid: false`
     - `isChecked`: true
   - Product appended to products array
   - Session created/updated — uses `file_name: "manual-entry"` instead of a file name
3. Form clears, focus returns to Nombre
4. From here, the flow is identical: Review/AI -> edit -> export

#### Intentional Divergences from CSV Flow

- **Barcode is optional for manual entry.** The CSV processor skips rows without barcodes, but manual entry allows it since the user may not have the barcode yet. A UUID is generated as the product ID instead.
- **Title duplicates show a warning, not a hard block.** In CSV import, title duplicates are silently skipped. In manual mode, the user sees a warning but can still add the product (they know what they're doing when entering manually).

#### Validation

- Nombre and Marca are required (button disabled if empty)
- If barcode is provided and exists in masterData or current products array, show inline error and block add
- If title matches an existing title (in masterData or current products), show inline warning (non-blocking)

#### Segmented Control

Built as a simple custom component using buttons + state (no third-party library). Two buttons styled as a pill toggle, active state uses the lime accent background.

### 2.2 UI Visual Polish

Keep the existing color palette. Improve execution quality across all components.

#### Spacing & Layout

- Page container: `max-w-6xl mx-auto` (centered, not full-width)
- More generous internal padding in cards and sections
- Consistent gaps between elements (`gap-6` to `gap-8`)

#### Cards

- Reduce from `rounded-3xl` to `rounded-2xl`
- Subtler, more consistent shadows
- Thinner borders

#### Buttons

- Reduce from `rounded-full` to `rounded-xl`
- Consistent sizing and padding
- Smooth hover transitions

#### Status Badges

- More compact and clean
- Consistent styling across table and mobile views

#### Table

- More spacious rows
- Professional headers: `uppercase tracking-wider text-xs font-medium`
- Subtle row hover

#### Inputs

- Uniform styling project-wide
- Subtler focus ring (less aggressive lime glow)

#### Navbar

- Cleaner, reduced visual weight

## 3. Files Modified

| File | Change |
|---|---|
| `src/app/page.tsx` | Add manual mode state, `handleManualAdd` handler, segmented toggle in Step 2 card, visual polish |
| `src/app/globals.css` | Adjust CSS tokens (shadows, radii, spacing, focus rings) |
| `src/components/file-dropzone.tsx` | Visual polish |
| `src/components/products-table.tsx` | Table redesign (spacing, badges, inputs, headers) |
| `src/components/main-nav.tsx` | Navbar polish |
| `src/components/product-review-dialog.tsx` | Visual polish |
| `src/components/flight-progress-bar.tsx` | Visual polish |
| `src/components/settings-dialog.tsx` | Visual polish |
| `src/components/session-recovery-dialog.tsx` | Visual polish |
| `src/components/ui/button.tsx` | Adjust base radius |
| `src/components/ui/card.tsx` | Adjust base radius and shadow |
| `src/components/ui/badge.tsx` | Polish |
| `src/components/ui/input.tsx` | Adjust focus styles |

## 4. New Files

| File | Purpose |
|---|---|
| `src/components/manual-product-form.tsx` | Inline form component for manual product entry. Fields: nombre, marca, precio, tamano, barcode. Handles validation, creation of ProcessedProduct, and form reset. |

## 5. Files NOT Changed

- `src/lib/csv-parser.ts` — master CSV parsing logic unchanged
- `src/lib/csv-exporter.ts` — export logic unchanged
- `src/lib/product-processor.ts` — processing types/logic unchanged (we reuse `ProcessedProduct` interface and `calculateUnitPrice`)
- `src/app/api/generate/route.ts` — AI route unchanged
- `src/lib/backup-service.ts` — backup works with `ProcessedProduct[]`, no changes needed

## 6. Approach

**Enfoque A — Panel inline expandible** (approved by user):
The Step 2 card uses a segmented control to switch between CSV upload and manual entry modes. Manual mode shows the form inline within the card. No modals, no slide-overs.

## 7. Success Criteria

- User can add products manually with just name + brand
- Manual products enter the same pipeline as CSV products (AI generation, editing, export)
- Multiple products can be added in sequence without closing/reopening anything
- Duplicate detection works for manual entries (barcode + title)
- All UI components feel cohesive and premium
- Existing functionality (CSV upload, AI generation, export) works exactly as before

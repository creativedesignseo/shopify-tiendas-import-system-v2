# Shopify Import System — Implementation Plan

This system automates the preparation of product CSVs for Shopify, using AI to generate content and logic to handle pricing, images, and duplicates.

## ✅ Current Status: Production Ready (with Hotfixes)
All core modules are implemented. Recent hotfixes addressed API Quota limits (Free Tier), CSV column mapping, and interactive UI feedback.

## User Review Required

> [!IMPORTANT]
> **Gemini API Key**: Ensure `GEMINI_API_KEY` is set in `.env.local`.
> **Model Usage**: The system defaults to **Gemini 1.5 Flash** for speed and cost, with a fallback mechanism if 2.0 Flash is unavailable.

---

## 1. Key Features Implemented

### 🔍 Smart CSV Import & Export
- **Flexible Header Matching**: The exporter now uses a "fuzzy match" logic (normalizing accents, case, and spaces) to correctly map AI data to the user's specific Master CSV columns (e.g., `Género` vs `genero`, `Tamaño` vs `Tamano`).
- **68-Column Integrity**: Preserves the exact structure of the Master CSV, filling in defaults (e.g., `Variant Grams: 350.0`, `Status: active`) where data is missing.
- **Duplicate Protection**: Automatically filters out products that already exist in the Master CSV based on Barcode.

### 🤖 AI Content Generation
- **Dual-Model Strategy**: Tries `gemini-2.0-flash` first; auto-falls back to `gemini-1.5-flash` on error.
- **Rich Content**: Generates SEO Titles, HTML Descriptions (using the Master's template), and specific Metafields (`Acorde`, `Ocasión`, `Estación`, etc.).
- **Visual Feedback**: Badges in the UI show which model was used (e.g., "1.5", "2.0") and any errors.

### 🖼️ Interactive UI
- **Image Previews**: Thumbnails with "Click to Google Search" functionality.
- **Unit Price Logic**: Auto-calculates EU unit prices (e.g., "35€ / 100ml").
- **Status Indicators**: Clear visual cues for Pending, Generating, Complete, and Error states.
- **Tooltips**: Hover over badges and icons for detailed info (e.g., exact unit measure detected).

---

## 2. Technical Architecture

### Core Modules
| Module | File | Purpose |
|--------|------|---------|
| **Dashboard** | `app/page.tsx` | Main UI. Handles file drops, state, and batch processing. |
| **Parser** | `lib/csv-parser.ts` | Reads Master CSV, extracts headers & templates. |
| **Processor** | `lib/product-processor.ts` | Logic for duplicates, unit price calc (`calculateUnitPrice`). |
| **Exporter** | `lib/csv-exporter.ts` | **Critical**: Maps processed data back to the 68 Master columns using normalized keys. |
| **AI Route** | `api/generate/route.ts` | Next.js API route. Handles Gemini requests, fallbacks, and JSON parsing. |

### Data Flow
1. **Upload Master**: System learns headers and existing barcodes.
2. **Upload New**: System filters duplicates and pre-calculates basic fields (Price, Size).
3. **Generate (AI)**: User clicks "Generate". System fetches descriptions/metafields from Gemini.
4. **Validation**: User reviews table. Edits if necessary (e.g., pastes image URLs).
5. **Export**: System matches data to Master headers → Downloads `shopify_import_ready.csv`.

---

## 3. Verification & Testing

### ✅ Verified
- [x] **Header Normalization**: `csv-exporter.ts` correctly finds `Tamaño` even if input is `Tamano` or `Option1 Name`.
- [x] **AI Fallback**: System gracefully degrades to 1.5 Flash if 2.0 fails.
- [x] **Unit Price**: Tooltip confirms correct parsing of "100 ml" vs "100ml".
- [x] **Interactivity**: Cursor pointers and hover effects are present on all clickable elements.

### ⏳ Pending User Action
- [ ] **Final Batch Test**: User to run a full batch of 5-10 products and import the resulting CSV into Shopify to confirm zero errors.

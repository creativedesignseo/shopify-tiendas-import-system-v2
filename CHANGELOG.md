# Changelog

All notable changes to this project will be documented in this file.

## [1.5.0] - 2026-02-14
### Added
- **Página de Changelog Visual**: Nueva ruta `/changelog` con historial completo de versiones en diseño timeline.
- **Badge de Versión**: Indicador `v1.5.0` visible en el header del dashboard con enlace al changelog.
- **Utilidad Centralizada `sanitizeBarcode()`**: Función única para limpieza de códigos de barras usada en todo el sistema.

### Fixed
- **Detección de Duplicados**: Corregido el fallo donde barcodes con comilla simple de Excel (`'`) no coincidían con los del archivo nuevo.

## [1.4.0] - 2026-02-13
### Changed
- **Visual Overhaul**: Complete redesign using **Uber's Design System** (Black/White palette, Pill buttons, Clean aesthetics).
- **Routing Revert**: Restored the Dashboard logic to the root path (`/`) and removed the separated Landing Page/Dashboard structure.
- **UI Components**: Refactored `Button`, `Input`, and `Card` components to match the new premium design language.

## [1.3.0] - 2026-02-13
### Added
- **Quota Management**: Smart "Quota Exceeded (429)" modal with actionable advice for free tier limits.
- **Model Selector**: Settings dropdown to switch between Gemini 2.0 Flash, 1.5 Pro, and Lite versions.
- **API Key Visibility**: Toggle to show/hide API Key and masked preview (last 4 chars) for verification.
- **Master Data Persistence**: Auto-save of "Master CSV" to `localStorage` to prevent data loss on reload.
- **Error Transparency**: Backend now returns masked API key and source (.env vs Settings) in 429/500 errors.
- **Debug UI**: Quota Error modal displays exactly which token failed and where it came from.

## [1.2.1] - 2026-02-12
### Fixed
- Corregida la discrepancia de conteo de productos usando `uniqueHandles.size` en lugar de `products.length`.
- Solucionados errores de mapeo en Metafields (`Ocasión`, `Estación`, `Aroma`).
- Eliminados errores de linting (no-explicit-any, unescaped entities) que bloqueaban el build.
- Añadido texto alternativo (`alt`) a todas las imágenes para cumplir con accesibilidad.
- **Vercel**: Desactivada la caché estática en `page.tsx` (`force-dynamic`) para resolver datos obsoletos en producción.
- **Despliegue**: Migrado exitosamente a **Netlify** para garantizar la frescura de datos y estabilidad del build.

## [1.2.0] - 2026-02-12
### Added
- **Final Shopify Compliance**: Stronger fuzzy matching logic for Unit Price headers.
- **New Task Tracker**: Detailed documentation of all 12 development phases.

### Fixed
- **Unit Price Formatting**: Forced decimal precision (e.g., `100.0`) to meet Shopify EU requirements.
- **Barcode Sanitization**: Automatic removal of leading single quotes (`'`) often added by Excel.
- **Column Mapping Collision**: Fixed bug where numeric measure columns were overwritten with "ml" due to fuzzy word matching.
- **Field Restoration**: Restored missing Price and Status mappings in the CSV exporter.
- **Metafield Mapping**: Resolved missing `Aroma`, `Ocasión`, and `Estación` in CSV export by matching exact Shopify headers.
- **Product Counting**: Fixed discrepancy by counting unique `Handles` (621) instead of `Barcodes` (543) in the master CSV.
- **AI Content**: Included `aroma` in the AI prompt and the review dialog's HTML fallback.

## [1.1.0] - 2026-02-11
### Added
- **Assisted Review Mode**: Selective export logic (only "Ready" products are exported).
- **Product Review Dialog**: Modal for manual review and single-product AI generation.
- **Model Fallback**: Automatic switching between Gemini 2.5 Flash and 2.0 Flash based on availability.
- **Status Indicators**: Visual badges (Listo, Error, AI Model) in the product table.

### Removed
- **Bulk AI Generation**: Removed to optimize API quota and improve data quality through manual review.

## [1.0.0] - 2026-02-10
### Added
- **Initial Release**: Core import/export functionality for Shopify CSVs.
- **Anti-duplicate Filter**: Barcode-based skip logic for existing products.
- **EU Unit Price Calculator**: Automatic extraction of measures from size strings (e.g., "100ml").
- **Gemini AI Integration**: Enrichment of titles, descriptions, and metafields.
- **Responsive Dashboard**: Modern UI with drag-and-drop file zones.

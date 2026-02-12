# Changelog

All notable changes to this project will be documented in this file.

## [1.2.0] - 2026-02-12
### Added
- **Final Shopify Compliance**: Stronger fuzzy matching logic for Unit Price headers.
- **New Task Tracker**: Detailed documentation of all 12 development phases.

### Fixed
- **Unit Price Formatting**: Forced decimal precision (e.g., `100.0`) to meet Shopify EU requirements.
- **Barcode Sanitization**: Automatic removal of leading single quotes (`'`) often added by Excel.
- **Column Mapping Collision**: Fixed bug where numeric measure columns were overwritten with "ml" due to fuzzy word matching.
- **Field Restoration**: Restored missing Price and Status mappings in the CSV exporter.

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

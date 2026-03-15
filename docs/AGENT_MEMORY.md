# Agent Memory / Handoff

Last updated: 2026-03-15

## Purpose
Single source of truth so any agent (Claude Code, Antigravity/Gemini, Codex) can continue this repository as if it were one engineering team.

## Product Summary
Internal Shopify import tool with:
- CSV ingestion and processing
- AI-assisted content generation (`/api/generate`)
- Shopify integration for dedupe and publish
- Session backup/recovery and UI review workflow

## Implemented Cycles

### Cycle 1 (Implemented)
- Shopify settings tab in `SettingsDialog`
- Test connection endpoint: `/api/shopify/test-connection`
- Live dedupe endpoint: `/api/shopify/dedupe`
- Shared client in `src/lib/shopify-client.ts`
- Dedupe results integrated in `products-table.tsx`

### Cycle 2 (Implemented)
- Output modes: `csv_only`, `shopify_only`, `csv_and_shopify`
- Product mapper: `src/lib/shopify-mapper.ts`
- Publish endpoint: `/api/shopify/publish`
- Publish dialog: `src/components/shopify-publish-dialog.tsx`
- Export flow integrated in `src/app/page.tsx`

## Current UX/Behavior
- Shopify modes can work without master CSV.
- In Shopify mode, connected store summary is shown in a separate card:
  - Store name
  - Total Shopify products (`productsCount`)
- Settings save shows a styled success modal (not browser alert).

## Important LocalStorage Keys
- AI:
  - `ai_provider`
  - `ai_api_key`
  - `ai_model_version`
- Shopify:
  - `shopify_shop_domain`
  - `shopify_access_token`
  - `shopify_api_version`
  - `shopify_profile_name`
  - `shopify_output_mode`
  - `shopify_connected`
  - `shopify_shop_name`
  - `shopify_products_count`

## Key Paths
- Main UI flow: `src/app/page.tsx`
- Settings: `src/components/settings-dialog.tsx`
- Review dialog: `src/components/product-review-dialog.tsx`
- Table + dedupe UI: `src/components/products-table.tsx`
- Shopify client: `src/lib/shopify-client.ts`
- Shopify mapper: `src/lib/shopify-mapper.ts`
- API routes:
  - `src/app/api/generate/route.ts`
  - `src/app/api/shopify/test-connection/route.ts`
  - `src/app/api/shopify/dedupe/route.ts`
  - `src/app/api/shopify/publish/route.ts`

## How to Verify Quickly
1. `npm run build`
2. Open app and configure Shopify in Settings
3. Click Test Connection and confirm:
   - Connected state
   - Store name + product count in UI
4. Run dedupe check from product table
5. Test publish flow in Shopify mode (dry run + live)

## Collaboration Convention
- Do not overwrite unrelated user changes.
- Keep commits focused and atomic.
- Update this file when adding a major workflow or changing storage keys/contracts.

# Agent Memory / Handoff

Last updated: 2026-03-15

## Objetivo
Contexto tecnico unico para que cualquier agente (Claude Code, Antigravity/Gemini, Codex) continue sin perder estado.

## Estado Tecnico

### Cycle 1 (Implementado)
- Settings Shopify en `src/components/settings-dialog.tsx`.
- Test conexion: `src/app/api/shopify/test-connection/route.ts`.
- Dedupe live: `src/app/api/shopify/dedupe/route.ts`.
- Cliente shared: `src/lib/shopify-client.ts`.

### Cycle 2 (Implementado)
- Output modes: `csv_only`, `shopify_only`, `csv_and_shopify`.
- Mapper: `src/lib/shopify-mapper.ts`.
- Publish route: `src/app/api/shopify/publish/route.ts`.
- Publish dialog: `src/components/shopify-publish-dialog.tsx`.
- Export flow: `src/app/page.tsx`.

## Cambios Recientes (ultimo bloque)
- Conexion Shopify ahora guarda nombre y productsCount en localStorage.
- Resumen de tienda conectado se muestra en card separada (no dentro de CSV Maestro).
- Settings save usa modal visual (sin alert generico).
- Boton IA habilitado en Shopify mode sin CSV maestro.
- `/api/generate` forzado a salida en espanol y title normalizado a nombre del perfume.
- `productCreate` actualizado a schema moderno (`ProductCreateInput + media`).
- Post-create update de variant para precio / sku / barcode / cost.
- Intento de inventario por defecto en 10 (si location/permisos lo permiten).

## LocalStorage Keys

### IA
- `ai_provider`
- `ai_api_key`
- `ai_model_version`

### Shopify
- `shopify_shop_domain`
- `shopify_access_token`
- `shopify_api_version`
- `shopify_profile_name`
- `shopify_output_mode`
- `shopify_connected`
- `shopify_shop_name`
- `shopify_products_count`

## Archivos Criticos
- `src/app/page.tsx`
- `src/components/settings-dialog.tsx`
- `src/components/products-table.tsx`
- `src/components/product-review-dialog.tsx`
- `src/lib/shopify-client.ts`
- `src/lib/shopify-mapper.ts`
- `src/app/api/generate/route.ts`

## Pendientes Conocidos
- Verificar en export Shopify post-fix que variant quede con campos completos en todos los casos de tienda.
- Si inventario no aplica por location/permisos, agregar seleccion de `locationId` en Settings.
- Decidir si mover secretos de localStorage a server-side secure storage (fuera de alcance actual).

## Regla de Colaboracion
- No sobrescribir cambios locales del usuario no relacionados.
- Commits pequenos y atomicos.
- Actualizar esta memoria despues de cada cambio importante.

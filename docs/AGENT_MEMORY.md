# Agent Memory / Handoff

Last updated: 2026-03-16

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
- Netlify MCP operativo en Codex: listado de sitios, lectura de proyecto y despliegue manual.
- Conexion Shopify guarda y sincroniza `shop_name` y `products_count` automaticamente (snapshot + refresh).
- Card de tienda conectada separada del bloque CSV Maestro.
- Flujo Shopify-only sin CSV Maestro para carga/generacion IA.
- `/api/generate` forzado a salida en espanol y titulo estilo catalogo (no slogan).
- Publicacion Shopify migrada a schema moderno (`ProductCreateInput + media`) + update de variante.
- Fix GraphQL: verificacion de barcode en `productVariant` (no `inventoryItem`).
- Inventario: intento estricto de activar tracking + ajuste de stock + verificacion post-create.
- Etiqueta de marca automatica: `vendor` se agrega a tags si falta.
- Nueva pestaña `Shopify` en la ficha de producto para editar campos antes de publicar.
- Normalizacion robusta de precio/coste en API publish para formatos con `€`, comas y espacios.
- Sanitizacion de barcode en publish route con `sanitizeBarcode()` (strip Excel quotes, decimals).
- Costo por producto ahora opcional en validacion de publish (no bloquea sin costPerItem).
- Soporte "Cost per item" / "Variant Cost" en CSV exporter.
- `.gitignore` actualizado: Test/ y .claude/ excluidos.
- Version bump a v1.9.1.

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
- `shopify_publication_mode`
- `shopify_publication_ids`
- `shopify_publications_cache`
- `shopify_default_inventory_qty`

## Archivos Criticos
- `src/app/page.tsx`
- `src/components/settings-dialog.tsx`
- `src/components/products-table.tsx`
- `src/components/product-review-dialog.tsx`
- `src/lib/shopify-client.ts`
- `src/lib/shopify-mapper.ts`
- `src/app/api/generate/route.ts`
- `src/app/api/shopify/publications/route.ts`
- `src/components/shopify-publish-dialog.tsx`
- `src/data/version.json`

## Pendientes Conocidos
- QA E2E en nube con lote real (precio, coste, barcode, inventario, peso, SEO, unit price).
- Si alguna tienda no permite ajuste por location/permisos: agregar selector explicito de `locationId`.
- Endurecer manejo de errores de inventario para reintento automatico por producto.
- Decidir mover secretos de localStorage a storage server-side (fuera de alcance actual).

## Regla de Colaboracion
- No sobrescribir cambios locales del usuario no relacionados.
- Commits pequenos y atomicos.
- Actualizar esta memoria despues de cada cambio importante.

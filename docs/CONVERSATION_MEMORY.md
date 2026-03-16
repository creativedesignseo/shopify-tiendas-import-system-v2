# Conversation Memory (Human + Multi-Agent)

Date: 2026-03-16

## Resumen Ejecutivo
Se ejecuto roadmap Shopify en 2 ciclos:

1. Cycle 1:
   - Settings Shopify
   - Test de conexion
   - Dedupe live contra catalogo Shopify
2. Cycle 2:
   - Publicacion live Shopify
   - Modos de salida (CSV / Shopify / Ambos)

Adicionalmente se hicieron fixes de UX y comportamiento para trabajar sin CSV maestro en Shopify mode.
Durante 2026-03-16 se cerro bloque de estabilizacion productiva (Netlify MCP + hardening de publish + edicion Shopify por producto).

## Hitos Confirmados
- Push a GitHub realizado varias veces sobre `main`.
- Netlify despliega desde GitHub (integracion por repo).
- Boton IA habilitado en modo Shopify sin maestro.
- Resumen tienda conectada fuera de card CSV maestro.
- Netlify MCP conectado y usable desde Codex.
- Deploys manuales ejecutados por MCP para validar fixes en nube.

## Problemas Detectados y Resueltos
- Error `ProductInput` con campos obsoletos (`bodyHtml`, `images`, `variants`):
  resuelto migrando mutation a schema actual.
- Producto creado con variant incompleto (precio 0 / default title):
  resuelto con mutation de update de variant post-create.
- Generacion IA en ingles y titulo tipo slogan:
  resuelto forzando prompt en espanol + title normalizado.
- Error `No se pudo verificar inventario: Field 'barcode' doesn't exist on type 'InventoryItem'`:
  resuelto verificando barcode en `productVariant`.
- Error `Inventario sin seguimiento (tracked=false) despues de crear`:
  mitigado forzando `inventoryItemUpdate(tracked: true)` + chequeo estricto.
- Validacion falsa de precio/coste en formato europeo (`29,04€`):
  resuelta con normalizacion robusta en `publish/route.ts`.

## Verificacion Recomendada (Post Deploy)
1. Configurar Shopify y probar conexion.
2. Confirmar card de tienda (nombre + total productos).
3. En ficha de producto, revisar nueva pestaña `Shopify` y ajustar campos si aplica.
4. Publicar 1 producto de prueba.
5. Validar en Shopify Admin:
   - variant price
   - inventory item cost
   - barcode / sku
   - tracked=true e inventario inicial
   - peso
   - tags con marca
   - SEO title/description
6. Exportar `products_export.csv` y validar:
   - Variant Price
   - Variant SKU
   - Variant Barcode
   - Inventory qty esperado
   - SEO title/description

## Nota de Continuidad
Este proyecto fue trabajado por:
- Claude Code
- Antigravity/Gemini
- Codex

Cualquier agente nuevo debe leer primero:
- `docs/AGENT_MEMORY.md`
- `CHANGELOG.md`
- specs/plans en `docs/superpowers/`

## Commits Relevantes Recientes (2026-03-16)
- `a650f59` fix barcode verification on variant.
- `4e4ec1e` enforce tracked inventory + auto vendor tag.
- `b3ab0ca` editable Shopify params per product + publish normalization.

# Conversation Memory (Human + Multi-Agent)

Date: 2026-03-15

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

## Hitos Confirmados
- Push a GitHub realizado varias veces sobre `main`.
- Netlify despliega desde GitHub (integracion por repo).
- Boton IA habilitado en modo Shopify sin maestro.
- Resumen tienda conectada fuera de card CSV maestro.

## Problemas Detectados y Resueltos
- Error `ProductInput` con campos obsoletos (`bodyHtml`, `images`, `variants`):
  resuelto migrando mutation a schema actual.
- Producto creado con variant incompleto (precio 0 / default title):
  resuelto con mutation de update de variant post-create.
- Generacion IA en ingles y titulo tipo slogan:
  resuelto forzando prompt en espanol + title normalizado.

## Verificacion Recomendada (Post Deploy)
1. Configurar Shopify y probar conexion.
2. Confirmar card de tienda (nombre + total productos).
3. Publicar 1 producto de prueba.
4. Exportar `products_export.csv` y validar:
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

# Shopify Tiendas Import System v2

Herramienta interna para importar, enriquecer, deduplicar y publicar productos en Shopify.

## Estado del Proyecto (2026-03-15)

- Cycle 1: Implementado (Settings Shopify, test de conexion, dedupe live).
- Cycle 2: Implementado (publish live, output modes, dialogo de publicacion).
- Flujo Shopify Live sin CSV maestro: activo.
- Soporte multi-agente: Claude Code + Antigravity/Gemini + Codex.

## Archivos de Handoff (OBLIGATORIO leer)

- `docs/AGENT_MEMORY.md`
- `docs/CONVERSATION_MEMORY.md`
- `docs/superpowers/specs/`
- `docs/superpowers/plans/`
- `CHANGELOG.md`

## Comandos

```bash
npm install
npm run dev
npm run build
```

App local: `http://localhost:3000`

## Flujo de Datos Clave

- Config IA y Shopify: `localStorage`.
- `csv_only`: requiere CSV maestro para exportar CSV.
- `shopify_only` y `csv_and_shopify`: maestro opcional, publica via API Shopify.

## API Routes

- `/api/generate`
- `/api/shopify/test-connection`
- `/api/shopify/dedupe`
- `/api/shopify/publish`

## Nota Operativa

Si un agente continua trabajo, debe actualizar:
- `CHANGELOG.md` (seccion Unreleased)
- `docs/AGENT_MEMORY.md`
- `docs/CONVERSATION_MEMORY.md`

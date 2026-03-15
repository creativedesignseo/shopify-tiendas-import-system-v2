# Shopify Tiendas Import System v2

Herramienta interna para importar, enriquecer, deduplicar y publicar productos en Shopify.

## Estado Actual (Mar 2026)

- Cycle 1 implementado: configuración Shopify, test de conexión y dedupe live.
- Cycle 2 implementado: publicación live a Shopify + modos de salida (`csv_only`, `shopify_only`, `csv_and_shopify`).
- Modo Shopify Live ya permite trabajar sin CSV maestro.
- La UI muestra tienda conectada + total de productos Shopify.

## Continuidad Multi-Agente

Este proyecto ya fue trabajado por múltiples agentes y puede continuar sin fricción:

- Claude Code
- Antigravity + Gemini
- Codex (GPT-5)

Para continuidad técnica entre agentes, revisar:

- `docs/AGENT_MEMORY.md`
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

## Notas de Flujo

- Configuración IA y Shopify se guarda en `localStorage`.
- En modo `csv_only`, el CSV maestro sigue siendo necesario para exportar CSV.
- En modos Shopify Live, el maestro es opcional.

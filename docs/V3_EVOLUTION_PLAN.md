# Plan de Evolución de Arquitectura: Shopify Importer & Auditor v3

Este documento detalla la transformación del sistema de un simple importador de CSV a un gestor inteligente de catálogos en vivo con auditoría persistente.

## 1. Contexto y Objetivos
El sistema original presentaba "alucinaciones" de IA al no contar con información olfativa real. Además, requería procesos manuales de exportación/importación de CSV.
La versión 3 se enfoca en:
- **Grounding Real:** Búsqueda automatizada en Fragrantica para obtener notas reales.
- **Copywriting Premium:** Redacción orientada a ventas y SEO, eliminando el tono puramente técnico.
- **Cero-CSV:** Conexión directa mediante la API GraphQL de Shopify para actualizaciones en vivo.
- **Auditoría Persistente:** Historial de cambios en Supabase para evitar trabajos duplicados y permitir procesamiento por lotes.

## 2. Arquitectura del Módulo de Auditoría (Dry Run)
El módulo operará bajo un flujo seguro de dos pasos:
1. **Fase de Análisis:** 
   - Se seleccionan N productos directamente de Shopify.
   - Se genera una previsualización comparativa: `Original` vs `AI-Proposed`.
   - Se listan errores detectados (ortografía, notas falsas, títulos inconsistentes).
2. **Fase de Aplicación:**
   - Una vez aprobado el lote por el usuario, se ejecuta la actualización masiva en Shopify.

## 3. Integración con Supabase
Se utilizará la base de datos para seguimiento de "Salud del Catálogo":
- **Tabla `audit_logs`:**
  - `shopify_product_id`: ID único del producto en Shopify.
  - `status`: `audited`, `completed`, `failed`.
  - `last_audit_at`: Timestamp.
  - `correction_summary`: Texto descriptivo de los cambios aplicados.

## 4. Estrategia de IA: "Grounding" Automatizado
Se integrará la librería `google-this` en el backend para que `src/app/api/generate/route.ts`:
1. Busque `Fragrantica [Marca] [Producto]`.
2. Extraiga el fragmento de texto con las notas olfativas.
3. Inyecte esta información en el prompt de Gemini/OpenAI como "Verdad Absoluta".

## 5. Diseño de Interfaz (UI)
Nueva ruta `/dashboard/corregir` con:
- Resumen de avance (Ej: 152/750 auditados).
- Selector de tamaño de lote.
- Tabla comparativa estilizada con los colores del branding actual (`#D6F45B`).

---
*Documento creado el 31 de marzo de 2026 para asegurar la persistencia del contexto de desarrollo.*

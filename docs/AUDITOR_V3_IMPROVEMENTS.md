# Plan de Mejoras: Auditor Inteligente v3.1

> Documento creado: 31 de marzo de 2026  
> Estado: **APROBADO — Pendiente de implementación**  
> Prioridad: Alta  

---

## Contexto

El módulo Auditor v3 (`/auditor`) ya funciona con el flujo básico:
1. Carga un lote de N productos de Shopify via GraphQL
2. Filtra los ya auditados (Supabase `audit_logs`)
3. Para cada producto, genera una propuesta de IA con copy premium
4. El usuario aprueba o ignora producto por producto

### Problemas actuales identificados
- El flujo es **lineal y secuencial** — solo puedes ver un producto a la vez
- Se muestra **poca información** del producto (solo título y body HTML)
- No hay forma de **buscar o filtrar** productos específicos
- La experiencia no permite **comparar el lote completo** antes de decidir

---

## Mejoras Planificadas

### Fase 1: Vista de Lote Completo (Batch Overview)

**Objetivo:** Ver todos los productos del lote en una tabla resumen ANTES de entrar a la revisión individual.

#### Cambios en UI (`src/app/auditor/page.tsx`)
- [ ] Añadir un nuevo estado/vista: `batch_overview` (tabla resumen) vs `product_review` (vista actual de detalle)
- [ ] Tabla de Batch Overview con columnas:
  - Miniatura (si disponible)
  - Título actual
  - Vendor/Marca
  - Precio (de la primera variante)
  - Tamaño (extraído del título o variante)
  - ID de Shopify (últimos dígitos para referencia rápida)
  - Status de IA: `pendiente` / `generado` / `aprobado` / `ignorado`
  - Botón "Revisar" para entrar al detalle de ese producto
- [ ] Barra de progreso del lote: `3/5 revisados`
- [ ] Botón "Aprobar todos los generados" para aprobación masiva
- [ ] Navegación libre entre productos (anterior/siguiente + click directo desde la tabla)

#### Datos adicionales a mostrar en la vista de detalle (`ProductDiff`)
- [ ] Precio actual del producto (variante principal)
- [ ] Tamaño/ML
- [ ] Barcode
- [ ] Tags actuales
- [ ] Product Type
- [ ] Status (ACTIVE/DRAFT)
- [ ] ID de Shopify completo (con link directo al admin de Shopify)
- [ ] Fecha de última modificación

**Archivos a modificar:**
- `src/app/auditor/page.tsx` — Refactor completo de la vista
- `src/lib/shopify-auditor.ts` — Ya trae la mayoría de datos, verificar que incluya `updatedAt`

---

### Fase 2: Búsqueda Selectiva y Filtros

**Objetivo:** Poder elegir qué productos auditar en vez de depender solo de lotes aleatorios.

#### Modo de carga dual
- [ ] **Modo Batch (actual):** Carga N productos sin auditar, ordenados por fecha
- [ ] **Modo Búsqueda:** Campo de texto con autocomplete para buscar por nombre

#### Búsqueda por nombre (Autocomplete)
- [ ] Nuevo endpoint: `POST /api/shopify/audit/search`
  - Recibe: `{ query: "Yara", shopDomain, accessToken }`
  - Usa GraphQL query con filtro `title` de Shopify
  - Devuelve máximo 20 resultados
- [ ] Input de búsqueda con debounce (300ms)
- [ ] Dropdown de resultados con: Título, Marca, Precio, Miniatura
- [ ] Al seleccionar un resultado, se añade a la cola de revisión
- [ ] Permitir seleccionar múltiples productos de la búsqueda

#### Query GraphQL para búsqueda:
```graphql
query searchProducts($query: String!, $first: Int!) {
  products(first: $first, query: $query) {
    edges {
      node {
        id
        title
        handle
        vendor
        featuredImage { url }
        variants(first: 1) {
          edges {
            node {
              price
              barcode
            }
          }
        }
      }
    }
  }
}
```

#### Filtro por Colección
- [ ] Nuevo endpoint: `POST /api/shopify/audit/collections`
  - Lista todas las colecciones de la tienda
- [ ] Selector/dropdown de colección en la UI
- [ ] Al seleccionar una colección, carga solo esos productos

**Archivos nuevos:**
- `src/app/api/shopify/audit/search/route.ts`
- `src/app/api/shopify/audit/collections/route.ts`

**Archivos a modificar:**
- `src/app/auditor/page.tsx` — Añadir panel de búsqueda y filtros
- `src/lib/shopify-auditor.ts` — Nueva función `searchProducts()`

---

### Fase 3: Persistencia y Registro de Auditoría (Supabase)

**Objetivo:** Garantizar que no se repita trabajo y mantener historial completo.

#### Tabla `audit_logs` (SQL para Supabase)
```sql
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'audited',
  diff_summary text,
  original_title text,
  new_title text,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON public.audit_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

#### Mejoras al tracking
- [ ] Guardar `original_title` y `new_title` para referencia histórica
- [ ] Guardar `user_id` del usuario que aprobó el cambio
- [ ] Contador en la UI: "152 / 750 auditados" con barra de progreso global
- [ ] Historial de auditorías recientes (últimos 20 cambios aplicados)

**Archivos a modificar:**
- `src/lib/auditor-db.ts` — Ampliar campos guardados
- `src/app/auditor/page.tsx` — Mostrar historial reciente

---

### Fase 4: Copy Engine (Mejoras al Prompt)

**Estado: ✅ IMPLEMENTADO** (31 marzo 2026)

Cambios ya aplicados en esta sesión:

- [x] Prompt reescrito para copy mobile-first, compacto y escaneable
- [x] **Arquitectura de datos estructurados**: La IA devuelve JSON plano, el backend ensambla el HTML desde una plantilla fija (`buildProductHTML()`)
- [x] Estructura HTML 100% consistente en todos los productos:
  - `<h2>` Headline emocional
  - `<p>` Gancho de 2-3 líneas
  - `<h3>Notas Olfativas</h3>` (siempre este título)
  - Salida / Corazón / Fondo
  - `<h3>¿Por qué elegirlo?</h3>`
  - Carácter / Ideal para / Sensación
- [x] Grounding exclusivo en Fragrantica (`site:fragrantica.com`)
- [x] Si no se encuentran notas, dice "Información no disponible" en vez de inventar
- [x] Máximo 150 palabras en body, max 40 palabras en hook

**Archivo modificado:** `src/app/api/generate/route.ts`

---

## Bugs Corregidos en esta Sesión (31 marzo 2026)

- [x] `ShieldCheck` no importado en `src/app/page.tsx` — Runtime crash
- [x] Supabase env vars con `!` assertion en `middleware.ts`, `client.ts`, `server.ts` — Crash sin `.env.local`
- [x] Auditor no enviaba API key del usuario a `/api/generate` — Error 401
- [x] Sin feedback de error cuando la IA fallaba — Spinner infinito
- [x] `.env.local` no existía — Supabase no conectaba

---

## Prioridad de Implementación

| # | Fase | Esfuerzo | Impacto | Prioridad |
|---|------|----------|---------|-----------|
| 1 | Vista de Lote Completo | Medio | Alto | 🔴 Alta |
| 2 | Búsqueda Selectiva | Medio | Alto | 🔴 Alta |
| 3 | Persistencia Supabase | Bajo | Alto | 🟡 Media |
| 4 | Copy Engine | ✅ Hecho | Alto | ✅ Completado |

---

## Notas Técnicas

### API GraphQL de Shopify usada
- `products(first: N, after: cursor)` — Lote por fecha
- `products(first: N, query: "title:Yara")` — Búsqueda por nombre
- `collections(first: 50)` — Listado de colecciones
- `collection(id: X) { products }` — Productos de una colección
- `productUpdate(input: {...})` — Aplicar cambios aprobados

### Stack
- Frontend: Next.js 16 + React 19 + Tailwind 4 + Radix UI
- Backend: API Routes (App Router)
- AI: OpenAI / Gemini (configurable)
- DB: Supabase (PostgreSQL + Auth + RLS)
- Grounding: DuckDuckGo HTML API → Fragrantica snippets

### Settings globales
Los ajustes de IA (provider, model, API key) y Shopify (domain, token) se leen del hook `useUserSettings()` que consulta la tabla `user_settings` en Supabase. Son globales para toda la app (Importador + Auditor).

---

*Documento vivo. Actualizar después de cada fase completada.*

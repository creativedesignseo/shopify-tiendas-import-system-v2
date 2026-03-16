# Perfume Knowledge Base & AI Agent — Spec

Status: **PENDIENTE** (documentado para futura implementacion)
Fecha: 2026-03-16

---

## Objetivo

Crear una base de datos propia de perfumes y un agente de IA que:
1. Proporcione datos **100% precisos** (notas, peso, familia olfativa, equivalencias) para el copy de Shopify.
2. Funcione como **asistente de perfumeria** para clientes (chat en tienda o WhatsApp).
3. Responda preguntas como: "¿Cual perfume arabe equivale a Calvin Klein One?" o "¿Que perfumes tienen notas de oud?"

---

## Arquitectura Propuesta

### 1. Base de Datos de Perfumes (Supabase)

Tabla `perfumes`:
| Campo | Tipo | Descripcion |
|---|---|---|
| id | uuid | PK |
| barcode | text | EAN/UPC unico |
| name | text | Nombre del perfume |
| brand | text | Marca |
| house | text | Casa perfumera (si aplica) |
| size_ml | integer | Tamano en ml |
| weight_grams | integer | Peso real (frasco + empaque) |
| product_type | text | Eau de Parfum, Eau de Toilette, etc. |
| gender | text | Hombre, Mujer, Unisex |
| family | text | Familia olfativa (Oriental, Floral, Amaderada, etc.) |
| top_notes | text[] | Notas de salida |
| heart_notes | text[] | Notas de corazon |
| base_notes | text[] | Notas de fondo |
| accords | text[] | Acordes principales |
| season | text | Estacion recomendada |
| occasion | text | Ocasion recomendada |
| longevity | text | Duracion estimada (Ligera, Moderada, Larga, Muy larga) |
| sillage | text | Proyeccion (Intima, Moderada, Fuerte, Enorme) |
| year_launched | integer | Ano de lanzamiento |
| perfumer | text | Nariz/perfumista creador |
| description_verified | text | Descripcion verificada manualmente |
| data_source | text | Origen: manual, fragrantica, IA-verificado |
| verified | boolean | true = datos revisados por humano |
| created_at | timestamp | |
| updated_at | timestamp | |

Tabla `perfume_equivalences` (para dupes / inspired-by):
| Campo | Tipo | Descripcion |
|---|---|---|
| id | uuid | PK |
| original_perfume_id | uuid | FK → perfumes (el original de marca) |
| dupe_perfume_id | uuid | FK → perfumes (el dupe/inspirado) |
| similarity_score | integer | 1-100 que tan similar es |
| relationship_type | text | "dupe", "inspired_by", "similar_to" |
| notes | text | Comentarios sobre la similitud |

Tabla `perfume_tags` (busqueda flexible):
| Campo | Tipo | Descripcion |
|---|---|---|
| perfume_id | uuid | FK → perfumes |
| tag | text | Tag libre: "arabe", "nicho", "celebrity", "verano", etc. |

### 2. Flujo de Enriquecimiento (Copy Generation)

```
Producto CSV/Manual
       ↓
  ¿Existe en BD propia? (buscar por barcode o nombre+marca)
       ↓                    ↓
      SI                   NO
       ↓                    ↓
  Usar datos verificados   Llamar IA (GPT-5/Claude)
       ↓                    ↓
  Generar copy preciso     Generar copy estimado
                            ↓
                     Guardar en BD como "IA-no-verificado"
                            ↓
                     Marcar para revision humana
```

**Beneficio:** Cada producto procesado alimenta la BD. Despues de 500-1000 productos, la mayoria de consultas se resuelven sin IA (rapido y gratis).

### 3. Agente de Perfumeria (Futuro)

**Casos de uso:**
- Cliente pregunta: "¿Tienen algo parecido a Baccarat Rouge 540?"
  → Agente busca en `perfume_equivalences` y responde con opciones del inventario.
- Cliente pregunta: "¿Que perfumes arabes tienen para hombre?"
  → Agente filtra por tags "arabe" + gender "Hombre" en inventario Shopify.
- Cliente pregunta: "¿Cuales son las notas de Oud Wood?"
  → Agente busca en BD propia, respuesta instantanea.

**Stack sugerido:**
- LLM: GPT-5 o Claude con function calling
- Base: Supabase (ya conectado)
- Embeddings: Para busqueda semantica de perfumes similares
- Canal: Widget web en Shopify + WhatsApp Business API (futuro)

### 4. Modelo de IA Recomendado

Para perfumeria de lujo donde la precision importa:

| Modelo | Costo aprox/producto | Precision | Recomendado para |
|---|---|---|---|
| Gemini 2.5 Flash | ~$0.001 | Buena | Productos masivos/draft |
| GPT-4o | ~$0.01 | Muy buena | Copy de calidad |
| GPT-5 / 5.4 | ~$0.02-0.05 | Excelente | Perfumeria de lujo, datos criticos |
| Claude Opus | ~$0.03 | Excelente | Alternativa premium |

**Recomendacion:** Usar GPT-5 para la generacion de copy + datos, y Gemini Flash solo para tareas de clasificacion rapida.

---

## Fases de Implementacion

### Fase 1: Base de datos (1-2 dias)
- Crear tablas en Supabase
- Script de migracion de productos existentes de Shopify → tabla perfumes
- Endpoint API para CRUD de perfumes

### Fase 2: Integracion con copy generation (1 dia)
- Modificar `/api/generate` para buscar primero en BD propia
- Si encuentra datos verificados, usarlos directo
- Si no, llamar IA y guardar resultado para revision

### Fase 3: Panel de verificacion (1-2 dias)
- UI para revisar datos generados por IA
- Marcar como verificado / corregir
- Import masivo desde CSV con datos de perfumes

### Fase 4: Tabla de equivalencias (1 dia)
- UI para crear relaciones dupe/inspired-by entre perfumes
- Busqueda por similitud

### Fase 5: Agente conversacional (2-3 dias)
- Chat widget con function calling
- Conectar a inventario Shopify + BD de perfumes
- Respuestas en espanol

---

## Notas

- La BD de Supabase ya esta conectada (`src/lib/supabase.ts`) para backups — se reutiliza la misma instancia.
- Los metafields actuales (acorde, genero, notas_salida, ocasion, estacion, aroma, sexo_objetivo) se mapean directamente a columnas de la tabla `perfumes`.
- El sistema actual usa `shopifyWeightGrams` con estimacion por IA — con la BD propia se usaria el peso real verificado.

import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import OpenAI from "openai";

const DEFAULT_GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
const DEFAULT_OPENAI_KEY = process.env.OPENAI_API_KEY || "";

function ensureBrandFirstTag(tags: string | undefined, brand: string): string {
  if (!brand) return tags || "";

  const brandClean = toTitleCase(brand.trim());
  if (!tags || !tags.trim()) return brandClean;

  const tagList = tags.split(",").map((t) => toTitleCase(t.trim())).filter(Boolean);
  const filtered = tagList.filter((t) => t.toLowerCase() !== brandClean.toLowerCase());
  return [brandClean, ...filtered].join(", ");
}

function toTitleCase(text: string): string {
  return text
    .split(" ")
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : ""))
    .join(" ")
    .trim();
}

function buildCatalogTitle(productName: string, brand: string, size?: string): string {
  const cleanName = toTitleCase((productName || "").trim());
  const cleanBrand = toTitleCase((brand || "").trim());
  const cleanSize = (size || "").trim();
  const parts = [cleanName, cleanBrand].filter(Boolean);
  let title = parts.join(" - ");
  if (cleanSize) title = `${title} ${cleanSize}`;
  return title.trim().slice(0, 70);
}

function normalizeGeneratedTitle(
  rawTitle: string | undefined,
  productName: string,
  brand: string,
  size?: string,
): string {
  return buildCatalogTitle(productName, brand, size);
}

// ============================================================================
// PLANTILLA HTML FIJA — Garantiza estructura idéntica en todos los productos
// ============================================================================
function buildProductHTML(data: {
  headline: string;
  hook: string;
  notas_salida: string;
  notas_corazon: string;
  notas_fondo: string;
  caracter: string;
  ideal_para: string;
  sensacion: string;
}): string {
  return `<h2>${data.headline}</h2>
<p>${data.hook}</p>
<h3>Notas Olfativas</h3>
<p><strong>Salida:</strong> ${data.notas_salida}</p>
<p><strong>Corazón:</strong> ${data.notas_corazon}</p>
<p><strong>Fondo:</strong> ${data.notas_fondo}</p>
<h3>¿Por qué elegirlo?</h3>
<p><strong>Carácter:</strong> ${data.caracter}<br/><strong>Ideal para:</strong> ${data.ideal_para}<br/><strong>Sensación:</strong> ${data.sensacion}</p>`;
}

export async function POST(req: Request) {
  let body: any = {};

  try {
    body = await req.json();
    const { product, htmlTemplate, provider = "gemini", apiKey, modelVersion } = body;

    const activeApiKey = apiKey || (provider === "openai" ? DEFAULT_OPENAI_KEY : DEFAULT_GEMINI_KEY);

    if (!activeApiKey) {
      return NextResponse.json(
        { error: `API Key not found for provider: ${provider}. Please configure it in Settings.` },
        { status: 401 }
      );
    }

    // --- GROUNDING: Multi-estrategia en cascada para Fragrantica ---
    let webContext = "";
    
    // Limpiar nombre del producto para mejorar búsqueda
    const cleanName = (product.Nombre || "")
      .replace(/\b(by|de|pour|for|eau|edp|edt|parfum)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    const cleanBrand = (product.Marca || "").trim();

    // Función helper de búsqueda en DuckDuckGo
    async function searchDDG(query: string): Promise<string[]> {
      try {
        const q = encodeURIComponent(query);
        const res = await fetch(`https://html.duckduckgo.com/html/?q=${q}`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
          signal: AbortSignal.timeout(5000)
        });
        if (!res.ok) return [];
        const html = await res.text();
        const snippets: string[] = [];
        const regex = /<a class="result__snippet[^>]*>(.*?)<\/a>/gis;
        let match;
        while ((match = regex.exec(html)) !== null && snippets.length < 5) {
          const clean = match[1].replace(/<\/?b>/gi, '').trim();
          if (clean.length > 20) snippets.push(clean);
        }
        return snippets;
      } catch {
        return [];
      }
    }

    // Estrategia 1: site:fragrantica.com con marca y nombre
    let snippets = await searchDDG(`site:fragrantica.com ${cleanBrand} ${cleanName}`);
    
    // Estrategia 2: solo el nombre del producto (la marca en Shopify a veces difiere de Fragrantica)
    if (snippets.length === 0) {
      snippets = await searchDDG(`fragrantica ${cleanName} notas`);
    }
    
    // Estrategia 3: nombre + marca + "notas de salida" (más específico)
    if (snippets.length === 0) {
      snippets = await searchDDG(`fragrantica "${cleanName}" ${cleanBrand} "notas de salida"`);
    }

    if (snippets.length > 0) {
      webContext = snippets.join(" | ");
      console.log(`Grounding OK: ${snippets.length} snippets encontrados para ${cleanName}`);
    } else {
      console.log(`Grounding FAIL: Sin resultados de Fragrantica para ${cleanName} (${cleanBrand})`);
    }
    
    const contextPrompt = webContext 
      ? `\nNOTAS REALES DE FRAGRANTICA (FUENTE PRIORITARIA — usa estas notas como base):\n"${webContext}"\n` 
      : "\nNo se pudo consultar Fragrantica automáticamente. Usa tu conocimiento de perfumería para proveer las notas olfativas si conoces este perfume. Si genuinamente NO conoces este perfume específico, pon 'Consultar en Fragrantica' en las notas.\n";

    // --- PROMPT: La IA devuelve SOLO datos estructurados, NO HTML ---
    const systemPrompt = `
Eres un Copywriter Senior de Perfumería de Lujo para E-commerce.

PRODUCTO:
- Nombre: "${product.Nombre}"
- Marca: "${product.Marca}"
- Tamaño: ${product.Tamaño || "No especificado"}
${contextPrompt}

TAREA:
Devuelve SOLO un JSON con los campos estructurados de abajo. NO generes HTML.
El backend ensamblará el HTML desde una plantilla fija.

CAMPOS A RELLENAR:

1) "headline": "${product.Nombre}: [Frase emocional de max 8 palabras]"
   Ejemplo: "Seasons Rise: Evolución aromática cautivadora"

2) "hook": Gancho de 2-3 líneas. Describe la EXPERIENCIA sensorial, no las notas.
   Menciona marca y nombre de forma natural. Tono elegante, conciso, mobile-first.
   MÁXIMO 40 palabras.

3) "notas_salida": Notas de salida REALES de Fragrantica, separadas por coma.
   Si no las conoces, pon "Información no disponible".

4) "notas_corazon": Notas de corazón REALES de Fragrantica, separadas por coma.
   Si no las conoces, pon "Información no disponible".

5) "notas_fondo": Notas de fondo REALES de Fragrantica, separadas por coma.
   Si no las conoces, pon "Información no disponible".

6) "caracter": Descripción del carácter en max 6 palabras (ej: "Gourmand floral con alma envolvente")

7) "ideal_para": Ocasión/estación en max 8 palabras (ej: "Otoño e invierno, ocasiones especiales")

8) "sensacion": Sensación en max 5 palabras (ej: "Calidez, elegancia y sofisticación")

9) "seo_title": Título SEO vendedor (max 60 caracteres)
10) "seo_description": Meta descripción con gancho emocional (max 160 caracteres)
11) "tags": PRIMERA etiqueta "${product.Marca}", luego 4-7 relevantes (ej: Amaderado, Gourmand)
12) "acorde": Acorde principal (ej: Amaderado, Floral, Oriental)
13) "genero": Masculino / Femenino / Unisex
14) "ocasion": Ocasión recomendada
15) "estacion": Estación recomendada
16) "aroma": Familia aromática
17) "sexo_objetivo": Hombre / Mujer / Unisex
18) "size_ml": Número en ml (0 si no se puede inferir)
19) "weight_grams": Peso estimado en gramos (100ml ≈ 350g)

REGLAS CRÍTICAS:
- PRIORIDAD 1: Usa las notas de Fragrantica si fueron proporcionadas arriba.
- PRIORIDAD 2: Si no hay datos de Fragrantica pero CONOCES este perfume, usa tu conocimiento real.
- PRIORIDAD 3: SOLO si genuinamente NO conoces este perfume, pon "Consultar en Fragrantica" en las notas.
- Español neutro, tono premium pero conciso.
- Responde SOLO JSON válido.

{
  "headline": "",
  "hook": "",
  "notas_salida": "",
  "notas_corazon": "",
  "notas_fondo": "",
  "caracter": "",
  "ideal_para": "",
  "sensacion": "",
  "seo_title": "",
  "seo_description": "",
  "tags": "",
  "acorde": "",
  "genero": "",
  "ocasion": "",
  "estacion": "",
  "aroma": "",
  "sexo_objetivo": "",
  "size_ml": 0,
  "weight_grams": 0
}`;

    let jsonResponse: any;

    if (provider === "openai") {
      const openai = new OpenAI({ apiKey: activeApiKey });
      const activeModel = modelVersion || "gpt-4o-mini";
      console.log(`Generating with OpenAI (${activeModel}) for:`, product.Nombre);

      const completion = await openai.chat.completions.create({
        model: activeModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Genera el JSON estructurado." }
        ],
        response_format: { type: "json_object" }
      });

      const content = completion.choices[0].message.content;
      if (!content) throw new Error("Empty response from OpenAI");
      jsonResponse = JSON.parse(content);
      jsonResponse.model_used = activeModel;
    } else {
      const genAI = new GoogleGenerativeAI(activeApiKey);
      const activeModel = modelVersion || "gemini-2.5-flash";

      const model = genAI.getGenerativeModel({
        model: activeModel,
        generationConfig: { responseMimeType: "application/json" }
      });

      console.log(`Generating with ${activeModel} for:`, product.Nombre);
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: systemPrompt + "\n\nGenera JSON:" }] }],
      });

      const response = await result.response;
      jsonResponse = JSON.parse(response.text());
      jsonResponse.model_used = activeModel;
    }

    // ============================================================
    // ENSAMBLAJE: HTML desde plantilla fija (la IA NO toca el HTML)
    // ============================================================
    jsonResponse.body_html = buildProductHTML({
      headline: jsonResponse.headline || `${product.Nombre}: Fragancia Premium`,
      hook: jsonResponse.hook || `Descubre ${product.Nombre} de ${product.Marca}.`,
      notas_salida: jsonResponse.notas_salida || "Información no disponible",
      notas_corazon: jsonResponse.notas_corazon || "Información no disponible",
      notas_fondo: jsonResponse.notas_fondo || "Información no disponible",
      caracter: jsonResponse.caracter || "Premium",
      ideal_para: jsonResponse.ideal_para || "Todas las ocasiones",
      sensacion: jsonResponse.sensacion || "Elegancia y distinción",
    });

    // Título determinístico
    jsonResponse.title = normalizeGeneratedTitle(
      jsonResponse.title,
      product.Nombre,
      product.Marca,
      product.Tamaño,
    );

    // Tags con marca primero
    jsonResponse.tags = ensureBrandFirstTag(jsonResponse.tags, product.Marca);

    // Metafields legacy compatibility
    jsonResponse.metafields = {
      acorde: jsonResponse.acorde || "",
      genero: jsonResponse.genero || "",
      notas_salida: jsonResponse.notas_salida || "",
      ocasion: jsonResponse.ocasion || "",
      estacion: jsonResponse.estacion || "",
      aroma: jsonResponse.aroma || "",
      sexo_objetivo: jsonResponse.sexo_objetivo || "",
    };
    jsonResponse.image_url = "";

    return NextResponse.json(jsonResponse);

  } catch (error: any) {
    console.error("AI Generation Error:", error);

    const { provider = "gemini", apiKey } = body || {};
    const isCustomKey = !!apiKey;
    const activeApiKey = apiKey || (provider === "openai" ? DEFAULT_OPENAI_KEY : DEFAULT_GEMINI_KEY);

    const maskedKey = activeApiKey && activeApiKey.length > 4
      ? `...${activeApiKey.slice(-4)}`
      : (activeApiKey ? "***" : "None");

    const keySource = isCustomKey ? "Settings (User)" : ".env (System)";

    return NextResponse.json(
      {
        error: error.message || "Internal Server Error",
        details: {
          masked_key: maskedKey,
          key_source: keySource,
          provider: provider,
          model_tried: body?.modelVersion || "default"
        }
      },
      { status: 500 }
    );
  }
}

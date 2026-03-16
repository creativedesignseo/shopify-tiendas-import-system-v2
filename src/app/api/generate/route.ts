import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import OpenAI from "openai";

const DEFAULT_GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
const DEFAULT_OPENAI_KEY = process.env.OPENAI_API_KEY || "";

function ensureBrandFirstTag(tags: string | undefined, brand: string): string {
  if (!brand) return tags || "";

  const brandClean = brand.trim();
  if (!tags || !tags.trim()) return brandClean;

  const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
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
  // En modo catalogo estricto usamos titulo deterministico (paridad con CSV).
  return buildCatalogTitle(productName, brand, size);
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

    const systemPrompt = `
Eres un catalogador tecnico para e-commerce de perfumeria.

TAREA:
Genera contenido tecnico y claro para un perfume especifico.
Todo el contenido debe estar en espanol neutro.

PRODUCTO OBJETIVO:
- Nombre del producto: "${product.Nombre}"
- Marca: "${product.Marca}"
- Tamano: ${product.Tamaño || "No especificado (intenta detectarlo del nombre, por ejemplo 100ml o 50 ml)"}

REFERENCIA HTML:
Usa la referencia SOLO para copiar estructura HTML.
No copies frases, nombres ni notas del ejemplo.

Referencia:
\`\`\`html
${htmlTemplate || "<!-- Sin plantilla, usa estructura estandar de descripcion de perfume -->"}
\`\`\`

REGLAS CRITICAS:
- Responde 100% en espanol.
- No uses tono comercial exagerado, claims de marketing ni frases en ingles.
- Evita palabras de venta como: "descubre", "experimenta", "lujo inigualable", "irresistible", etc.
- Usa estilo de ficha tecnica: preciso, informativo y neutral.
- "body_html" debe hablar unicamente de "${product.Nombre}" de "${product.Marca}".
- Si la plantilla menciona otros productos, ignoralos.

REQUISITOS DE SALIDA:
1) title: usa exactamente este formato: "${product.Nombre} - ${product.Marca}${product.Tamaño ? ` ${product.Tamaño}` : ""}" (max 70).
2) body_html: HTML en espanol con estructura limpia y factual (descripcion, notas, uso recomendado).
3) seo_title: titulo SEO (max 60 caracteres).
4) seo_description: meta descripcion (max 160 caracteres).
5) tags: la PRIMERA etiqueta debe ser "${product.Marca}", luego 4-7 etiquetas relevantes.
6) metafields: objeto con claves: acorde, genero, notas_salida, ocasion, estacion, aroma, sexo_objetivo.
7) image_url: cadena vacia "".
8) size_ml: numero en ml (100, 50, 200). Si no se puede inferir, usa 0.

FORMATO:
Responde solo JSON valido, sin markdown:
{
  "title": "string",
  "body_html": "string (HTML)",
  "seo_title": "string",
  "seo_description": "string",
  "tags": "string",
  "image_url": "",
  "size_ml": 100,
  "metafields": {
    "acorde": "string",
    "genero": "string",
    "notas_salida": "string",
    "ocasion": "string",
    "estacion": "string",
    "aroma": "string",
    "sexo_objetivo": "string"
  }
}`;

    if (provider === "openai") {
      const openai = new OpenAI({ apiKey: activeApiKey });
      console.log("Generating with OpenAI (gpt-4o-mini) for:", product.Nombre);

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Genera el contenido en JSON." }
        ],
        response_format: { type: "json_object" }
      });

      const content = completion.choices[0].message.content;
      if (!content) throw new Error("Empty response from OpenAI");

      const jsonResponse = JSON.parse(content);
      jsonResponse.model_used = "gpt-4o-mini";
      jsonResponse.title = normalizeGeneratedTitle(
        jsonResponse.title,
        product.Nombre,
        product.Marca,
        product.Tamaño,
      );
      jsonResponse.tags = ensureBrandFirstTag(jsonResponse.tags, product.Marca);
      return NextResponse.json(jsonResponse);
    }

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
    const jsonResponse = JSON.parse(response.text());
    jsonResponse.model_used = activeModel;
    jsonResponse.title = normalizeGeneratedTitle(
      jsonResponse.title,
      product.Nombre,
      product.Marca,
      product.Tamaño,
    );
    jsonResponse.tags = ensureBrandFirstTag(jsonResponse.tags, product.Marca);
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

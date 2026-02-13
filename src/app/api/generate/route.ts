import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import OpenAI from "openai";

const DEFAULT_GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
const DEFAULT_OPENAI_KEY = process.env.OPENAI_API_KEY || "";

/**
 * SAFETY NET: Ensures the brand is ALWAYS the first tag.
 * - If tags are empty → returns just the brand.
 * - If brand is already first → returns as-is.
 * - If brand exists elsewhere → moves it to first position.
 * - If brand is missing → prepends it.
 */
function ensureBrandFirstTag(tags: string | undefined, brand: string): string {
  if (!brand) return tags || "";
  
  const brandClean = brand.trim();
  if (!tags || !tags.trim()) return brandClean;
  
  const tagList = tags.split(",").map(t => t.trim()).filter(Boolean);
  
  // Remove brand if it exists anywhere (case-insensitive)
  const filtered = tagList.filter(t => t.toLowerCase() !== brandClean.toLowerCase());
  
  // Always put brand first
  return [brandClean, ...filtered].join(", ");
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
      You are an expert SEO copywriter for a high-end perfume store.
      
      ## YOUR TASK
      Generate UNIQUE content for a SPECIFIC perfume product. The content MUST be 100% original and specific to THIS product.
      
      ## PRODUCT TO WRITE ABOUT (THIS is the product you must describe)
      - Product Name: "${product.Nombre}"
      - Brand: "${product.Marca}"
      - Size: ${product.Tamaño || "N/A"}
      
      ## HTML STRUCTURE REFERENCE
      Below is an example HTML structure from another product. Use ONLY the HTML tags/structure as a formatting guide.
      
      ⚠️ CRITICAL RULES:
      - NEVER copy any text, product names, descriptions, or notes from this template
      - ONLY replicate the HTML tag structure (<h2>, <h3>, <p>, <strong>, etc.)
      - ALL text content MUST be original and about "${product.Nombre}" by "${product.Marca}"
      - If the template mentions another product name, IGNORE it completely
      
      Structure reference:
      \`\`\`html
      ${htmlTemplate || "<!-- No template provided, use standard perfume description structure -->"}
      \`\`\`
      
      ## OUTPUT REQUIREMENTS
      1. **title**: Catchy, premium title that includes "${product.Marca}" and "${product.Nombre}".
      2. **body_html**: MUST contain original HTML content about "${product.Nombre}". Use the same HTML tag structure as the reference but with COMPLETELY NEW text. Include olfactory notes, characteristics, and recommendations.
      3. **seo_title**: SEO-optimized title (max 60 chars) for "${product.Nombre}".
      4. **seo_description**: Compelling meta description (max 160 chars).
      5. **tags**: CRITICAL: The FIRST tag MUST ALWAYS be the brand name "${product.Marca}". Then add 4-7 more relevant tags. Example: "${product.Marca}, perfume, oriental, amaderado". NEVER omit the brand as first tag.
      6. **metafields**: Object with keys: acorde, genero, notas_salida, ocasion, estacion, aroma, sexo_objetivo.
      7. **image_url**: Leave as empty string "".
      
      ## OUTPUT FORMAT
      Respond with valid JSON only. No markdown wrapping. Use this exact schema:
      {
        "title": "string",
        "body_html": "string (HTML)",
        "seo_title": "string",
        "seo_description": "string",
        "tags": "string",
        "image_url": "",
        "metafields": {
          "acorde": "string",
          "genero": "string", 
          "notas_salida": "string",
          "ocasion": "string",
          "estacion": "string",
          "aroma": "string",
          "sexo_objetivo": "string"
        }
      }

      REMEMBER: You are writing about "${product.Nombre}" by "${product.Marca}". NOT about any product mentioned in the HTML template.
    `;

    // --- OPENAI HANDLER ---
    if (provider === "openai") {
      const openai = new OpenAI({ apiKey: activeApiKey });
      console.log("Generating with OpenAI (gpt-4o-mini) for:", product.Nombre);
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Generate product content." }
        ],
        response_format: { type: "json_object" }
      });

      const content = completion.choices[0].message.content;
      if (!content) throw new Error("Empty response from OpenAI");
      
      const jsonResponse = JSON.parse(content);
      jsonResponse.model_used = "gpt-4o-mini";
      // SAFETY NET: Ensure brand is always the first tag
      jsonResponse.tags = ensureBrandFirstTag(jsonResponse.tags, product.Marca);
      return NextResponse.json(jsonResponse);
    }

    // --- GEMINI HANDLER (Default) ---
    const genAI = new GoogleGenerativeAI(activeApiKey);
    const activeModel = modelVersion || "gemini-2.5-flash";

    const model = genAI.getGenerativeModel({ 
        model: activeModel, 
        generationConfig: { responseMimeType: "application/json" }
    });
    
    console.log(`Generating with ${activeModel} for:`, product.Nombre);
    const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: systemPrompt + "\n\nGenerate JSON:" }] }],
    });
    
    const response = await result.response;
    const jsonResponse = JSON.parse(response.text());
    jsonResponse.model_used = activeModel;
    // SAFETY NET: Ensure brand is always the first tag
    jsonResponse.tags = ensureBrandFirstTag(jsonResponse.tags, product.Marca);
    return NextResponse.json(jsonResponse);

  } catch (error: any) {
    console.error("AI Generation Error:", error);
    
    // Determine which key was active using the pre-parsed body
    const { provider = "gemini", apiKey } = body || {}; 
    const isCustomKey = !!apiKey;
    const activeApiKey = apiKey || (provider === "openai" ? DEFAULT_OPENAI_KEY : DEFAULT_GEMINI_KEY);
    
    // Mask logic
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

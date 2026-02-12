import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(req: Request) {
  try {
    const { product, htmlTemplate } = await req.json();

    if (!apiKey) {
      return NextResponse.json(
        { error: "API Key not set. Please configure GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY in environment variables." },
        { status: 500 }
      );
    }

    const prompt = `
      You are an expert SEO copywriter for a high-end perfume store.
      
      Task: Generate content for a new perfume product based on the input data and strictly follow the provided HTML structure.
      
      Input Data:
      - Name: ${product.Nombre}
      - Brand: ${product.Marca}
      - Size: ${product.Tamaño}
      
      Reference HTML Template (You MUST use this exact detailed structure, just replacing the content):
      \`\`\`html
      ${htmlTemplate}
      \`\`\`
      
      Requirements:
      1. **Title**: Catchy, premium, includes Brand & Name.
      2. **Body (HTML)**: CRITICAL: You must NEVER leave this empty. Use the provided template. Replace descriptions with unique, evocative text for THIS product. If the template is missing, generate a standard premium perfume description HTML structure with <h3>Description</h3>, <p>details</p>, and <ul>notes</ul>.
      3. **SEO Title**: Optimized for search engines (60 chars max).
      4. **SEO Description**: Compelling meta description (160 chars max).
      5. **Tags**: 5-8 relevant tags (comma separated string).
      6. **Metafields**: Infer the following attributes based on the perfume name/brand context:
         - Acorde (e.g. Dulce, Amaderado, Floral)
         - Género (Hombre, Mujer, Unisex)
         - Notas de salida (comma separated)
         - Ocasión (e.g. Noche, Día, Cita)
         - Estación (e.g. Invierno, Verano, Otoño, Primavera)
         - Aroma (e.g. Intenso, Suave, Dulce, Fresco, Especiado)
         - Sexo objetivo (Male, Female, Unisex)
      
      Output Format: JSON ONLY. No markdown.
      {
        "title": "string",
        "body_html": "string (minified html, NEVER EMPTY)",
        "seo_title": "string",
        "seo_description": "string",
        "tags": "string",
        "metafields": {
          "acorde": "string",
          "genero": "string",
          "notas_salida": "string",
          "ocasion": "string",
          "estacion": "string",
          "aroma": "string (e.g. Intenso, Floral, Amaderado)",
          "sexo_objetivo": "string"
        },
        "image_query": "string (specific product search query for images)"
      }
    `;

    // Attempt generation with Primary Model (2.5 Flash - Newest)
    try {
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json" }
      });
      console.log("Generating with Gemini 2.5 Flash for:", product.Nombre);
      
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });
      const response = await result.response;
      const jsonResponse = JSON.parse(response.text());
      jsonResponse.model_used = "gemini-2.5-flash";
      return NextResponse.json(jsonResponse);
    
    } catch (error: unknown) {
      const err = error as Error;
      console.warn("Gemini 2.5 Flash failed, falling back to 2.0 Flash. Error:", err.message);
      
      // Fallback to Secondary Model (2.0 Flash)
      try {
        const fallbackModel = genAI.getGenerativeModel({ 
          model: "gemini-2.0-flash",
          generationConfig: { responseMimeType: "application/json" }
        });
        console.log("Fallback generating with Gemini 2.0 Flash for:", product.Nombre);

        const result = await fallbackModel.generateContent({
           contents: [{ role: "user", parts: [{ text: prompt }] }],
        });
        const response = await result.response;
        const jsonResponse = JSON.parse(response.text());
        jsonResponse.model_used = "gemini-2.0-flash";
        return NextResponse.json(jsonResponse);

      } catch (fallbackError: unknown) {
        const err = fallbackError as any;
        console.error("Gemini 2.0 Fallback failed:", err);
        
        let errorMessage = "Failed to generate content";
        let status = 500;
        const errBody = err.response || err;

        // Detect Quota/Rate Limit errors
        if (
          errBody.status === 429 || 
          err.message?.includes("429") || 
          err.message?.includes("Quota") ||
          err.message?.includes("quota")
        ) {
          errorMessage = "⏳ Límite de cuota excedido (Google Free Tier). Intenta más tarde o añade facturación.";
          status = 429;
        } else {
          errorMessage = err.message || errorMessage;
        }

        return NextResponse.json(
          { error: errorMessage, details: err.message }, 
          { status }
        );
      }
    }

  } catch (error: unknown) {
    const err = error as Error;
    console.error("General API Error:", err);
    return NextResponse.json(
      { error: "Internal Server Error", details: err.message }, 
      { status: 500 }
    );
  }
}

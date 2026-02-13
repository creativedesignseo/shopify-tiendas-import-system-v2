import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import OpenAI from "openai";

const DEFAULT_GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
const DEFAULT_OPENAI_KEY = process.env.OPENAI_API_KEY || "";

export async function POST(req: Request) {
  try {
    const { product, htmlTemplate, provider = "gemini", apiKey, modelVersion } = await req.json();

    const activeApiKey = apiKey || (provider === "openai" ? DEFAULT_OPENAI_KEY : DEFAULT_GEMINI_KEY);

    if (!activeApiKey) {
      return NextResponse.json(
        { error: `API Key not found for provider: ${provider}. Please configure it in Settings.` },
        { status: 401 }
      );
    }

    const systemPrompt = `
      You are an expert SEO copywriter for a high-end perfume store.
      
      Task: Generate content for a new perfume product based on the input data and strictly follow the provided HTML structure.
      
      Input Data:
      - Name: ${product.Nombre}
      - Brand: ${product.Marca}
      - Size: ${product.Tamaño}
      
      Reference HTML Template (You MUST use this exact detailed structure, just replacing the content):
      \`\`\`html
      ${htmlTemplate || "<!-- No template provided, use standard structure -->"}
      \`\`\`
      
      Requirements:
      1. **Title**: Catchy, premium, includes Brand & Name.
      2. **Body (HTML)**: CRITICAL: You must NEVER leave this empty. Use the provided template. Replace descriptions with unique, evocative text for THIS product.
      3. **SEO Title**: Optimized for search engines (60 chars max).
      4. **SEO Description**: Compelling meta description (160 chars max).
      5. **Tags**: 5-8 relevant tags (comma separated string).
      6. **Metafields**: Infer attributes (Acorde, Género, Notas, Ocasión, Estación, Aroma).
      
      Output Format: JSON ONLY. No markdown.
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
      return NextResponse.json(jsonResponse);
    }

    // --- GEMINI HANDLER (Default) ---
    const genAI = new GoogleGenerativeAI(activeApiKey);
    const activeModel = modelVersion || "gemini-2.0-flash";

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
    return NextResponse.json(jsonResponse);

  } catch (error: any) {
    console.error("AI Generation Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" }, 
      { status: 500 }
    );
  }
}

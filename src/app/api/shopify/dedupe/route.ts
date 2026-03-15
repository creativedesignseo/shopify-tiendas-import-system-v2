import { NextResponse } from "next/server";
import { checkDuplicates } from "@/lib/shopify-client";

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const { shopDomain, accessToken, apiVersion, products } = await req.json();

    if (!shopDomain || !accessToken || !apiVersion) {
      return NextResponse.json(
        { success: false, error: "Faltan credenciales de Shopify" },
        { status: 400 }
      );
    }

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { success: false, error: "No se proporcionaron productos para verificar" },
        { status: 400 }
      );
    }

    const results = await checkDuplicates(
      { shopDomain, accessToken, apiVersion },
      products
    );

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Error durante la verificación de duplicados" },
      { status: 500 }
    );
  }
}

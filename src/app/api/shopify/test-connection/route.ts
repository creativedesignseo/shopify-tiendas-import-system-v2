import { NextResponse } from "next/server";
import { testShopifyConnection } from "@/lib/shopify-client";

export async function POST(req: Request) {
  try {
    const { shopDomain, accessToken, apiVersion } = await req.json();

    if (!shopDomain || !accessToken || !apiVersion) {
      return NextResponse.json(
        { success: false, error: "Faltan campos requeridos: shopDomain, accessToken, apiVersion" },
        { status: 400 }
      );
    }

    const result = await testShopifyConnection({
      shopDomain,
      accessToken,
      apiVersion,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}

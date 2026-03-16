import { NextResponse } from "next/server";
import { listShopifyPublications } from "@/lib/shopify-client";

export async function POST(req: Request) {
  try {
    const { shopDomain, accessToken, apiVersion } = await req.json();

    if (!shopDomain || !accessToken || !apiVersion) {
      return NextResponse.json(
        { success: false, error: "Faltan credenciales de Shopify" },
        { status: 400 },
      );
    }

    const result = await listShopifyPublications({
      shopDomain,
      accessToken,
      apiVersion,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno del servidor";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

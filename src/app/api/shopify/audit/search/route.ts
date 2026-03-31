import { NextResponse } from "next/server";
import { searchProducts } from "@/lib/shopify-auditor";

export async function POST(req: Request) {
  try {
    const { query, shopDomain, accessToken, apiVersion, limit } = await req.json();

    if (!query || !shopDomain || !accessToken) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const config = {
      shopDomain,
      accessToken,
      apiVersion: apiVersion || "2025-01",
    };

    const result = await searchProducts(config, query, limit || 20);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

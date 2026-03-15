// src/app/api/shopify/publish/route.ts
import { NextResponse } from "next/server";
import { createShopifyProduct, CreateProductResult } from "@/lib/shopify-client";
import { mapProductToShopify, validateForShopify } from "@/lib/shopify-mapper";
import { ProcessedProduct } from "@/lib/product-processor";

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const { shopDomain, accessToken, apiVersion, products, dryRun } = await req.json();

    if (!shopDomain || !accessToken || !apiVersion) {
      return NextResponse.json(
        { success: false, error: "Faltan credenciales de Shopify" },
        { status: 400 }
      );
    }

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { success: false, error: "No se proporcionaron productos" },
        { status: 400 }
      );
    }

    const config = { shopDomain, accessToken, apiVersion };
    const results: CreateProductResult[] = [];
    let created = 0, skipped = 0, failed = 0;

    for (const product of products as ProcessedProduct[]) {
      // Skip duplicates detected by Cycle 1 dedupe
      if (product.shopifyDupeMatchType) {
        results.push({
          barcode: product.barcode,
          title: product.generatedTitle || product.title,
          status: "skipped",
          error: `Duplicado (${product.shopifyDupeMatchType})`,
        });
        skipped++;
        continue;
      }

      // Validate required fields
      const missingFields = validateForShopify(product);
      if (missingFields.length > 0) {
        results.push({
          barcode: product.barcode,
          title: product.generatedTitle || product.title,
          status: "failed",
          error: `Campos faltantes: ${missingFields.join(", ")}`,
        });
        failed++;
        continue;
      }

      // Dry run: validate only, don't create
      if (dryRun) {
        results.push({
          barcode: product.barcode,
          title: product.generatedTitle || product.title,
          status: "created",
        });
        created++;
        continue;
      }

      // Live: create product in Shopify
      const shopifyInput = mapProductToShopify(product);
      const result = await createShopifyProduct(config, shopifyInput);
      results.push(result);

      if (result.status === "created") created++;
      else if (result.status === "skipped") skipped++;
      else failed++;
    }

    return NextResponse.json({
      success: true,
      results,
      summary: { created, skipped, failed },
      dryRun: !!dryRun,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error durante la publicación";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

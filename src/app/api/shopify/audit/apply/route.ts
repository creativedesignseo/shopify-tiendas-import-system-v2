import { NextResponse } from "next/server";
import { updateShopifyProduct, ProductUpdateData } from "@/lib/shopify-auditor";
import { AuditorDB } from "@/lib/auditor-db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { shopDomain, accessToken, apiVersion, productId, updateData } = await req.json();

    if (!shopDomain || !accessToken || !productId || !updateData) {
      return NextResponse.json({ success: false, error: "Datos faltantes para la actualización" }, { status: 400 });
    }

    const config = { shopDomain, accessToken, apiVersion: apiVersion || "2024-01" };

    // 1. Update in Shopify
    const result = await updateShopifyProduct(config, productId, updateData as ProductUpdateData);

    // 2. Register Audit Log
    if (result.success) {
      const summary = `Cambiado Título a: ${updateData.title || "-"} | HTML modificado.`;
      await AuditorDB.trackAudit({
        product_id: productId,
        status: 'audited',
        diff_summary: summary
      });
      return NextResponse.json({ success: true, message: "Producto actualizado y auditado correctamente." });
    } else {
      await AuditorDB.trackAudit({
        product_id: productId,
        status: 'failed',
        diff_summary: `Error: ${result.error}`
      });
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }
  } catch (err: any) {
    console.error("Audit / Apply Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

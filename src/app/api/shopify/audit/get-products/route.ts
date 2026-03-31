import { NextResponse } from "next/server";
import { fetchAuditableProducts } from "@/lib/shopify-auditor";
import { AuditorDB } from "@/lib/auditor-db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { shopDomain, accessToken, apiVersion, limit = 50, cursor = null } = await req.json();

    if (!shopDomain || !accessToken) {
      return NextResponse.json({ success: false, error: "Credenciales de Shopify faltantes" }, { status: 400 });
    }

    const config = { shopDomain, accessToken, apiVersion: apiVersion || "2024-01" };

    // 1. Fetch products from Shopify
    const { products, hasNextPage, endCursor, error } = await fetchAuditableProducts(config, 250, cursor);
    if (error) {
      return NextResponse.json({ success: false, error }, { status: 500 });
    }

    // 2. Fetch audited IDs from Supabase for filtering
    const auditedIds = await AuditorDB.getAuditedProductIds();

    // 3. Filter products that haven't been audited yet
    const remainingProducts = products.filter(p => !auditedIds.has(p.id));

    // Limit to the requested batch size (we fetch 250 from Shopify to ensure we get enough after filtering)
    const finalBatch = remainingProducts.slice(0, limit);

    // 4. Also fetch some global stats for the UI
    const stats = await AuditorDB.getStats();

    return NextResponse.json({
      success: true,
      products: finalBatch,
      pageInfo: { hasNextPage, endCursor },
      totalRemainingAtCurrentFetch: remainingProducts.length,
      globalStats: stats
    });

  } catch (err: any) {
    console.error("Audit / Get Products Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

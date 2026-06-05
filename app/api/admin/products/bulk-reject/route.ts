import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/permissions";

type BulkProduct = {
  id: string;
  title: string;
  status: string;
  vendor_id: string;
  shopify_product_gid?: string | null;
};

export async function POST(request: Request) {
  const ctx = await requireAdminApi();
  if ("error" in ctx) return ctx.error;

  const body = await request.json().catch(() => ({}));
  const productIds = Array.isArray(body.productIds) ? body.productIds.filter((id: unknown): id is string => typeof id === "string") : [];
  if (!productIds.length) return NextResponse.json({ error: "Select at least one submitted product." }, { status: 400 });

  const { data: products, error } = await ctx.supabase
    .from("vendor_products")
    .select("id,title,status,vendor_id,shopify_product_gid")
    .in("id", productIds);

  if (error) return NextResponse.json({ error: "Could not load selected products.", details: error.message }, { status: 400 });

  const rows = (products ?? []) as BulkProduct[];
  const foundIds = new Set(rows.map((product) => product.id));
  const failedItems: { productId: string; title?: string; error: string }[] = [];

  for (const productId of productIds) {
    if (!foundIds.has(productId)) failedItems.push({ productId, error: "Product not found." });
  }

  const eligibleProducts = rows.filter((product) => product.status === "submitted" && !product.shopify_product_gid);
  const skippedProducts = rows.filter((product) => product.status !== "submitted" || product.shopify_product_gid);
  failedItems.push(...skippedProducts.map((product) => ({
    productId: product.id,
    title: product.title,
    error: "Only submitted products without an existing Shopify draft can be rejected."
  })));

  let successCount = 0;
  const rejectedAt = new Date().toISOString();

  for (const product of eligibleProducts) {
    const { data, error: updateError } = await ctx.supabase
      .from("vendor_products")
      .update({ status: "rejected", rejected_at: rejectedAt, rejection_reason: null })
      .eq("id", product.id)
      .eq("status", "submitted")
      .is("shopify_product_gid", null)
      .select("id,vendor_id")
      .single();

    if (updateError || !data) {
      failedItems.push({ productId: product.id, title: product.title, error: updateError?.message ?? "Product could not be rejected." });
      continue;
    }

    successCount += 1;
    await ctx.supabase.from("activity_logs").insert({
      user_id: ctx.profile.id,
      vendor_id: product.vendor_id,
      action: "product_rejected",
      entity_type: "vendor_products",
      entity_id: product.id,
      metadata: { bulk: true }
    });
  }

  return NextResponse.json({
    successCount,
    failedCount: failedItems.length,
    failedItems
  });
}

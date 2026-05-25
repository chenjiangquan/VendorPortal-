import { NextResponse } from "next/server";
import { requireVendorApi } from "@/lib/permissions";

export async function POST(request: Request) {
  const ctx = await requireVendorApi();
  if ("error" in ctx) return ctx.error;

  const body = await request.json().catch(() => ({}));
  const productIds = Array.isArray(body.productIds) ? body.productIds.filter((id: unknown) => typeof id === "string") : [];
  if (!productIds.length) return NextResponse.json({ error: "Select at least one product." }, { status: 400 });

  const { data: products, error } = await ctx.supabase
    .from("vendor_products")
    .select("id,title,status,vendor_id")
    .eq("vendor_id", ctx.vendor.id)
    .in("id", productIds);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  let archivedCount = 0;
  let requestCount = 0;
  const failedItems: { id: string; title?: string; error: string }[] = [];

  for (const product of products ?? []) {
    try {
      if (["approved", "shopify_draft"].includes(product.status)) {
        const { data: existing } = await ctx.supabase
          .from("product_change_requests")
          .select("id")
          .eq("product_id", product.id)
          .eq("vendor_id", ctx.vendor.id)
          .eq("request_type", "delete")
          .eq("status", "pending")
          .maybeSingle();
        if (existing) continue;
        const { error: requestError } = await ctx.supabase.from("product_change_requests").insert({
          product_id: product.id,
          vendor_id: ctx.vendor.id,
          request_type: "delete",
          proposed_data: { snapshot: product },
          reason: null
        });
        if (requestError) throw requestError;
        requestCount += 1;
        continue;
      }

      if (product.status === "archived") continue;
      const { error: archiveError } = await ctx.supabase
        .from("vendor_products")
        .update({ status: "archived", updated_at: new Date().toISOString() })
        .eq("id", product.id)
        .eq("vendor_id", ctx.vendor.id);
      if (archiveError) throw archiveError;
      archivedCount += 1;
    } catch (error) {
      failedItems.push({ id: product.id, title: product.title, error: error instanceof Error ? error.message : "Bulk delete failed." });
    }
  }

  await ctx.supabase.from("activity_logs").insert({
    user_id: ctx.profile.id,
    vendor_id: ctx.vendor.id,
    action: "vendor_products_bulk_delete_requested",
    entity_type: "vendor_products",
    metadata: { product_ids: productIds, archivedCount, requestCount, failedItems }
  });

  return NextResponse.json({
    archivedCount,
    requestCount,
    failedCount: failedItems.length,
    failedItems,
    message: `${archivedCount} products archived. ${requestCount} delete requests submitted.`
  });
}

import { NextResponse } from "next/server";
import { requireVendorApi } from "@/lib/permissions";

export async function POST(request: Request) {
  const ctx = await requireVendorApi();
  if ("error" in ctx) return ctx.error;

  const body = await request.json().catch(() => ({}));
  const productId = typeof body.product_id === "string" ? body.product_id : "";
  const requestType = body.request_type === "delete" ? "delete" : body.request_type === "edit" ? "edit" : null;
  if (!productId || !requestType) return NextResponse.json({ error: "product_id and request_type are required." }, { status: 400 });

  const { data: product } = await ctx.supabase
    .from("vendor_products")
    .select("*, product_images(*), product_variants(*)")
    .eq("id", productId)
    .eq("vendor_id", ctx.vendor.id)
    .single();

  if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });
  if (!["approved", "shopify_draft"].includes(product.status)) {
    return NextResponse.json({ error: "Only approved or Shopify Draft products can use change requests." }, { status: 400 });
  }

  const { data: existing, error: existingError } = await ctx.supabase
    .from("product_change_requests")
    .select("id")
    .eq("product_id", productId)
    .eq("vendor_id", ctx.vendor.id)
    .eq("request_type", requestType)
    .eq("status", "pending")
    .maybeSingle();

  if (existingError && isMissingProductChangeRequestsTable(existingError)) {
    return NextResponse.json({
      error: requestType === "edit" ? "Update request could not be submitted. Please contact admin." : "Delete request could not be submitted. Please contact admin.",
      details: existingError.message
    }, { status: 500 });
  }
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 400 });
  if (existing) return NextResponse.json({ error: `A pending ${requestType} request already exists for this product.` }, { status: 400 });

  if (requestType === "delete" && !String(body.reason ?? "").trim()) {
    return NextResponse.json({ error: "Delete reason is required." }, { status: 400 });
  }

  const proposedData = requestType === "edit"
    ? { ...(body.proposed_data ?? {}), product_images: product.product_images ?? [] }
    : { snapshot: product };

  const { data, error } = await ctx.supabase
    .from("product_change_requests")
    .insert({
      product_id: productId,
      vendor_id: ctx.vendor.id,
      request_type: requestType,
      proposed_data: proposedData,
      reason: String(body.reason ?? "").trim() || null
    })
    .select()
    .single();

  if (error && isMissingProductChangeRequestsTable(error)) {
    return NextResponse.json({
      error: requestType === "edit" ? "Update request could not be submitted. Please contact admin." : "Delete request could not be submitted. Please contact admin.",
      details: error.message
    }, { status: 500 });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await ctx.supabase.from("activity_logs").insert({
    user_id: ctx.profile.id,
    vendor_id: ctx.vendor.id,
    action: requestType === "edit" ? "product_update_requested" : "product_delete_requested",
    entity_type: "product_change_requests",
    entity_id: data.id,
    metadata: { product_id: productId }
  });

  return NextResponse.json({ request: data, message: requestType === "edit" ? "Update request submitted for admin review." : "Delete request submitted." });
}

function isMissingProductChangeRequestsTable(error: { code?: string; message?: string }) {
  return error.code === "42P01" || error.message?.includes("product_change_requests") || false;
}

import { buildDescriptionHtml } from "@/lib/product-description";
import { archiveShopifyProduct, updateShopifyDraftProduct } from "@/lib/shopify";

const PRODUCT_FIELDS = [
  "title",
  "description",
  "description_data",
  "final_description",
  "product_type",
  "category",
  "tags",
  "price",
  "compare_at_price",
  "cost_price",
  "sku",
  "barcode",
  "stock",
  "seo_title",
  "seo_description",
  "google_product_category",
  "has_variants",
  "options"
];

export async function approveEditRequest(ctx: any, requestId: string) {
  const { data: request } = await ctx.supabase
    .from("product_change_requests")
    .select("*, vendor_products(*)")
    .eq("id", requestId)
    .eq("request_type", "edit")
    .eq("status", "pending")
    .single();

  if (!request) throw new Error("Pending edit request not found.");

  const proposed = request.proposed_data ?? {};
  const productPatch = Object.fromEntries(PRODUCT_FIELDS.filter((field) => field in proposed).map((field) => [field, proposed[field]]));
  if (proposed.description_data) {
    const html = buildDescriptionHtml(proposed.description_data);
    productPatch.description = html;
    productPatch.final_description = html;
  }

  const { error: updateError } = await ctx.supabase
    .from("vendor_products")
    .update({ ...productPatch, updated_at: new Date().toISOString() })
    .eq("id", request.product_id);
  if (updateError) throw new Error(updateError.message);

  if ("variants" in proposed) {
    const { error: deleteError } = await ctx.supabase.from("product_variants").delete().eq("product_id", request.product_id);
    if (deleteError) throw new Error(deleteError.message);
    if (Array.isArray(proposed.variants) && proposed.variants.length) {
      const { error: insertError } = await ctx.supabase.from("product_variants").insert(
        proposed.variants.map((variant: Record<string, unknown>) => ({
          ...variant,
          product_id: request.product_id,
          vendor_id: request.vendor_id
        }))
      );
      if (insertError) throw new Error(insertError.message);
    }
  }

  const shopifyResult = await updateShopifyDraftProduct(request.product_id);

  const { error: requestError } = await ctx.supabase
    .from("product_change_requests")
    .update({ status: "approved", reviewed_by: ctx.profile.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", request.id);
  if (requestError) throw new Error(requestError.message);

  await ctx.supabase.from("activity_logs").insert({
    user_id: ctx.profile.id,
    vendor_id: request.vendor_id,
    action: "product_update_request_approved",
    entity_type: "product_change_requests",
    entity_id: request.id,
    metadata: { product_id: request.product_id, shopify_result: shopifyResult }
  });

  return shopifyResult;
}

export async function approveDeleteRequest(ctx: any, requestId: string) {
  const { data: request } = await ctx.supabase
    .from("product_change_requests")
    .select("*, vendor_products(*)")
    .eq("id", requestId)
    .eq("request_type", "delete")
    .eq("status", "pending")
    .single();

  if (!request) throw new Error("Pending delete request not found.");

  const shopifyResult = await archiveShopifyProduct(request.product_id);

  const { error: productError } = await ctx.supabase
    .from("vendor_products")
    .update({ status: "archived", shopify_status: "ARCHIVED", updated_at: new Date().toISOString() })
    .eq("id", request.product_id);
  if (productError) throw new Error(productError.message);

  const { error: requestError } = await ctx.supabase
    .from("product_change_requests")
    .update({ status: "approved", reviewed_by: ctx.profile.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", request.id);
  if (requestError) throw new Error(requestError.message);

  await ctx.supabase.from("activity_logs").insert({
    user_id: ctx.profile.id,
    vendor_id: request.vendor_id,
    action: "product_delete_request_approved",
    entity_type: "product_change_requests",
    entity_id: request.id,
    metadata: { product_id: request.product_id, shopify_result: shopifyResult }
  });

  return shopifyResult;
}

export async function rejectProductRequest(ctx: any, requestId: string, adminNote: string) {
  const { data, error } = await ctx.supabase
    .from("product_change_requests")
    .update({ status: "rejected", admin_note: adminNote, reviewed_by: ctx.profile.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "pending")
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

import { NextResponse } from "next/server";
import { requireVendorApi } from "@/lib/permissions";
import { inferProductType } from "@/lib/product-type";
import { productDraftSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const ctx = await requireVendorApi();
    if ("error" in ctx) return ctx.error;
    const parsed = productDraftSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Product data is invalid." }, { status: 400 });
    const { variants, pending_images, ...productInput } = parsed.data;
    productInput.product_type = productInput.product_type || inferProductType(productInput.title, productInput.category);

    const productMutation = await insertVendorProduct(ctx.supabase, { ...productInput, vendor_id: ctx.vendor.id, status: "draft" });
    if (productMutation.error) return NextResponse.json({ error: productMutation.error.message }, { status: 400 });
    const product = productMutation.data;

    if (variants?.length) {
      const { error: variantError } = await ctx.supabase.from("product_variants").insert(
        variants.map((variant) => ({
          ...variant,
          product_id: product.id,
          vendor_id: ctx.vendor.id
        }))
      );
      if (variantError) return NextResponse.json({ error: variantError.message }, { status: 400 });
    }

    if (pending_images?.length) {
      const { error: imageError } = await ctx.supabase.from("product_images").insert(
        pending_images.map((image, index) => ({
          product_id: product.id,
          vendor_id: ctx.vendor.id,
          url: image.url,
          storage_path: image.storage_path,
          alt_text: image.alt_text ?? "",
          position: image.position ?? index
        }))
      );
      if (imageError) return NextResponse.json({ error: imageError.message }, { status: 400 });
    }

    await ctx.supabase.from("activity_logs").insert({ user_id: ctx.profile.id, vendor_id: ctx.vendor.id, action: "product_draft_saved", entity_type: "vendor_products", entity_id: product.id });
    return NextResponse.json({ product });
  } catch (error) {
    console.error("Vendor product create failed", error);
    return NextResponse.json({ error: "Could not save product.", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

async function insertVendorProduct(supabase: any, productInput: Record<string, unknown>) {
  const first = await supabase.from("vendor_products").insert(productInput).select().single();
  if (!isMissingOptionalCategoryColumn(first.error)) return first;

  const fallbackInput = { ...productInput };
  delete fallbackInput.category_id;
  delete fallbackInput.shopify_category_id;
  return supabase.from("vendor_products").insert(fallbackInput).select().single();
}

function isMissingOptionalCategoryColumn(error: { message?: string } | null) {
  if (!error?.message) return false;
  return error.message.includes("'category_id' column") || error.message.includes("'shopify_category_id' column");
}

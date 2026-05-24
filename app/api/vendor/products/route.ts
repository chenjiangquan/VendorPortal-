import { NextResponse } from "next/server";
import { requireVendorApi } from "@/lib/permissions";
import { productDraftSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const ctx = await requireVendorApi();
  if ("error" in ctx) return ctx.error;
  const parsed = productDraftSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const { variants, pending_images, ...productInput } = parsed.data;

  const { data: product, error } = await ctx.supabase
    .from("vendor_products")
    .insert({ ...productInput, vendor_id: ctx.vendor.id, status: "draft" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

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
}

import { NextResponse } from "next/server";
import { requireVendorApi } from "@/lib/permissions";
import { productDraftSchema } from "@/lib/validators";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireVendorApi();
    if ("error" in ctx) return ctx.error;
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const { data: existing } = await ctx.supabase.from("vendor_products").select("*").eq("id", id).eq("vendor_id", ctx.vendor.id).single();
    if (!existing) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    if (!["draft", "rejected"].includes(existing.status)) return NextResponse.json({ error: "Submitted or approved products cannot be edited by vendor." }, { status: 403 });

    if (body.image) {
      const { data, error } = await ctx.supabase.from("product_images").insert({ ...body.image, product_id: id, vendor_id: ctx.vendor.id }).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ image: data });
    }

    if (body.image_alt) {
      const { data, error } = await ctx.supabase
        .from("product_images")
        .update({ alt_text: body.image_alt.alt_text ?? "" })
        .eq("id", body.image_alt.id)
        .eq("product_id", id)
        .eq("vendor_id", ctx.vendor.id)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ image: data });
    }

    if (body.delete_image_id) {
      const { error } = await ctx.supabase
        .from("product_images")
        .delete()
        .eq("id", body.delete_image_id)
        .eq("product_id", id)
        .eq("vendor_id", ctx.vendor.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    if (Array.isArray(body.image_positions)) {
      for (const image of body.image_positions) {
        if (!image.id) continue;
        const { error } = await ctx.supabase
          .from("product_images")
          .update({ position: image.position })
          .eq("id", image.id)
          .eq("product_id", id)
          .eq("vendor_id", ctx.vendor.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ ok: true });
    }

    const parsed = productDraftSchema.partial().safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Product data is invalid." }, { status: 400 });
    const { variants, pending_images, ...productInput } = parsed.data;
    const productMutation = await updateVendorProduct(ctx.supabase, productInput, id, ctx.vendor.id);
    if (productMutation.error) return NextResponse.json({ error: productMutation.error.message }, { status: 400 });
    const product = productMutation.data;

    if (variants) {
      const { error: deleteError } = await ctx.supabase.from("product_variants").delete().eq("product_id", id).eq("vendor_id", ctx.vendor.id);
      if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });
      if (variants.length) {
        const { error: insertError } = await ctx.supabase.from("product_variants").insert(
          variants.map((variant) => ({
            ...variant,
            product_id: id,
            vendor_id: ctx.vendor.id
          }))
        );
        if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });
      }
    }

    if (pending_images?.length) {
      const { error: imageError } = await ctx.supabase.from("product_images").insert(
        pending_images.map((image, index) => ({
          product_id: id,
          vendor_id: ctx.vendor.id,
          url: image.url,
          storage_path: image.storage_path,
          alt_text: image.alt_text ?? "",
          position: image.position ?? index
        }))
      );
      if (imageError) return NextResponse.json({ error: imageError.message }, { status: 400 });
    }

    return NextResponse.json({ product });
  } catch (error) {
    console.error("Vendor product save failed", error);
    return NextResponse.json({ error: "Could not save product.", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

async function updateVendorProduct(supabase: any, productInput: Record<string, unknown>, id: string, vendorId: string) {
  const first = await supabase.from("vendor_products").update(productInput).eq("id", id).eq("vendor_id", vendorId).select().single();
  if (!isMissingOptionalCategoryColumn(first.error)) return first;

  const fallbackInput = { ...productInput };
  delete fallbackInput.category_id;
  delete fallbackInput.shopify_category_id;
  return supabase.from("vendor_products").update(fallbackInput).eq("id", id).eq("vendor_id", vendorId).select().single();
}

function isMissingOptionalCategoryColumn(error: { message?: string } | null) {
  if (!error?.message) return false;
  return error.message.includes("'category_id' column") || error.message.includes("'shopify_category_id' column");
}

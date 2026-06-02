import { NextResponse } from "next/server";
import { requireVendorApi } from "@/lib/permissions";
import { buildDescriptionHtml, normaliseDescriptionData, titleCaseRequiredDescriptionDetails, titleCaseText } from "@/lib/product-description";
import { productDraftPartialSchema } from "@/lib/validators";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireVendorApi();
    if ("error" in ctx) return ctx.error;
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const { data: existing } = await ctx.supabase.from("vendor_products").select("id,status").eq("id", id).eq("vendor_id", ctx.vendor.id).single();
    if (!existing) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    if (!["draft", "rejected"].includes(existing.status)) return NextResponse.json({ error: "Only draft or rejected products can be submitted." }, { status: 403 });

    if (Object.keys(body).length) {
      const parsed = productDraftPartialSchema.safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Product data is invalid." }, { status: 400 });
      const saveResult = await saveDraftSnapshot(ctx.supabase, parsed.data, id, ctx.vendor.id);
      if (saveResult.error) return NextResponse.json({ error: saveResult.error.message }, { status: 400 });
    }

    const productResult = await ctx.supabase.from("vendor_products").select("*, product_images(id), product_variants(*)").eq("id", id).eq("vendor_id", ctx.vendor.id).single();
    if (productResult.error || !productResult.data) return NextResponse.json({ error: productResult.error?.message ?? "Product not found" }, { status: 404 });
    const product = productResult.data;
    const validationError = validateProductForSubmit(product, body);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

    const submittedDescriptionData = titleCaseRequiredDescriptionDetails(normaliseDescriptionData(product.description_data));
    const submittedTitle = titleCaseText(product.title);
    const descriptionHtml = buildDescriptionHtml(submittedDescriptionData);
    const { data, error } = await ctx.supabase
      .from("vendor_products")
      .update({ title: submittedTitle, description_data: submittedDescriptionData, status: "submitted", submitted_at: new Date().toISOString(), rejection_reason: null, final_description: descriptionHtml, description: descriptionHtml })
      .eq("id", id)
      .eq("vendor_id", ctx.vendor.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await ctx.supabase.from("activity_logs").insert({ user_id: ctx.profile.id, vendor_id: ctx.vendor.id, action: "product_submitted", entity_type: "vendor_products", entity_id: id });
    return NextResponse.json({ product: data });
  } catch (error) {
    console.error("Vendor product submit failed", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message || "Could not submit product." }, { status: 500 });
  }
}

async function saveDraftSnapshot(supabase: any, data: Record<string, any>, productId: string, vendorId: string) {
  const { variants, pending_images, ...productInput } = data;
  const productResult = await updateVendorProduct(supabase, productInput, productId, vendorId);
  if (productResult.error) return productResult;

  if (variants) {
    const { error: deleteError } = await supabase.from("product_variants").delete().eq("product_id", productId).eq("vendor_id", vendorId);
    if (deleteError) return { data: null, error: deleteError };
    if (variants.length) {
      const { error: insertError } = await supabase.from("product_variants").insert(
        variants.map((variant: Record<string, unknown>) => ({
          ...variant,
          product_id: productId,
          vendor_id: vendorId
        }))
      );
      if (insertError) return { data: null, error: insertError };
    }
  }

  if (pending_images?.length) {
    const { error: imageError } = await supabase.from("product_images").insert(
      pending_images.map((image: Record<string, any>, index: number) => ({
        product_id: productId,
        vendor_id: vendorId,
        url: image.url,
        storage_path: image.storage_path,
        alt_text: image.alt_text ?? "",
        position: image.position ?? index
      }))
    );
    if (imageError) return { data: null, error: imageError };
  }

  return productResult;
}

async function updateVendorProduct(supabase: any, productInput: Record<string, unknown>, id: string, vendorId: string) {
  const first = await supabase.from("vendor_products").update(productInput).eq("id", id).eq("vendor_id", vendorId).select().single();
  if (!isMissingOptionalCategoryColumn(first.error)) return first;

  const fallbackInput = { ...productInput };
  delete fallbackInput.category_id;
  delete fallbackInput.shopify_category_id;
  return supabase.from("vendor_products").update(fallbackInput).eq("id", id).eq("vendor_id", vendorId).select().single();
}

function validateProductForSubmit(product: any, body: Record<string, unknown>) {
  if (!product.title) return "Please complete Title before submitting.";
  if (product.has_variants) {
    const variants = product.product_variants ?? [];
    if (!variants.length) return "Please add at least one variant.";
    if (variants.some((variant: any) => variant.price === null || variant.price === undefined || Number(variant.price) <= 0)) return "Please complete price for all variants before submitting.";
    if (variants.some((variant: any) => variant.stock === null || variant.stock === undefined || Number(variant.stock) < 0)) return "Please complete stock for all variants before submitting.";
  } else {
    if (!product.price || Number(product.price) <= 0) return "Please complete Price before submitting.";
    if (product.stock === null || product.stock === undefined || Number(product.stock) < 0) return "Please complete Stock before submitting.";
  }

  const descriptionData = normaliseDescriptionData(product.description_data);
  if (!descriptionData.overview.length) return "Please complete Product Overview before submitting.";
  const missingRequiredDetails = ["Colour", "Material", "Assembly"].filter((label) => !descriptionData.details.find((row) => row.label === label)?.value);
  if (missingRequiredDetails.length) return "Please complete Colour, Material and Assembly in Details.";
  const imageCount = product.product_images?.length ?? Number(body.image_count ?? 0);
  if (imageCount < 1) return "Please add at least one product image.";
  return null;
}

function isMissingOptionalCategoryColumn(error: { message?: string } | null) {
  if (!error?.message) return false;
  return error.message.includes("'category_id' column") || error.message.includes("'shopify_category_id' column");
}

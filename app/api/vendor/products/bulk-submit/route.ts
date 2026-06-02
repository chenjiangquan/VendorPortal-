import { NextResponse } from "next/server";
import { requireVendorApi } from "@/lib/permissions";
import { buildDescriptionHtml, normaliseDescriptionData, titleCaseRequiredDescriptionDetails, titleCaseText } from "@/lib/product-description";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const ctx = await requireVendorApi();
    if ("error" in ctx) return ctx.error;
    const adminSupabase = createAdminClient();

    const body = await request.json().catch(() => ({}));
    const productIds = Array.isArray(body.productIds) ? body.productIds.filter((id: unknown) => typeof id === "string") : [];
    if (!productIds.length) return NextResponse.json({ error: "Select at least one draft or rejected product." }, { status: 400 });

    const { data: products, error } = await adminSupabase
      .from("vendor_products")
      .select("*, product_images(id), product_variants(*)")
      .eq("vendor_id", ctx.vendor.id)
      .in("id", productIds);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    let successCount = 0;
    const failedItems: { id: string; title?: string; error: string }[] = [];
    const foundIds = new Set((products ?? []).map((product: any) => product.id));
    for (const productId of productIds) {
      if (!foundIds.has(productId)) failedItems.push({ id: productId, error: "Product not found." });
    }

    for (const product of products ?? []) {
      try {
        if (!["draft", "rejected"].includes(product.status)) {
          failedItems.push({ id: product.id, title: product.title, error: "Only draft or rejected products can be submitted." });
          continue;
        }

        const validationError = validateProductForSubmit(product);
        if (validationError) {
          failedItems.push({ id: product.id, title: product.title, error: validationError });
          continue;
        }

        const submittedDescriptionData = titleCaseRequiredDescriptionDetails(normaliseDescriptionData(product.description_data));
        const submittedTitle = titleCaseText(product.title);
        const descriptionHtml = buildDescriptionHtml(submittedDescriptionData);
        const { error: updateError } = await adminSupabase
          .from("vendor_products")
          .update({ title: submittedTitle, description_data: submittedDescriptionData, status: "submitted", submitted_at: new Date().toISOString(), rejection_reason: null, final_description: descriptionHtml, description: descriptionHtml })
          .eq("id", product.id)
          .eq("vendor_id", ctx.vendor.id);
        if (updateError) throw updateError;
        successCount += 1;
      } catch (error) {
        failedItems.push({ id: product.id, title: product.title, error: error instanceof Error ? error.message : "Product could not be submitted." });
      }
    }

    if (successCount) {
      await adminSupabase.from("activity_logs").insert({
        user_id: ctx.profile.id,
        vendor_id: ctx.vendor.id,
        action: "vendor_products_bulk_submitted",
        entity_type: "vendor_products",
        metadata: { product_ids: productIds, successCount, failedItems }
      });
    }

    return NextResponse.json({
      successCount,
      failedCount: failedItems.length,
      failedItems,
      message: `${successCount} products submitted.`
    });
  } catch (error) {
    console.error("Vendor bulk submit failed", error);
    return NextResponse.json({ error: "Products could not be submitted.", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

function validateProductForSubmit(product: any) {
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
  if ((product.product_images?.length ?? 0) < 1) return "Please add at least one product image.";
  return null;
}

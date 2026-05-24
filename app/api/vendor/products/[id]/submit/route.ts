import { NextResponse } from "next/server";
import { requireVendorApi } from "@/lib/permissions";
import { buildDescriptionHtml, normaliseDescriptionData } from "@/lib/product-description";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireVendorApi();
  if ("error" in ctx) return ctx.error;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { data: product } = await ctx.supabase.from("vendor_products").select("*, product_images(id)").eq("id", id).eq("vendor_id", ctx.vendor.id).single();
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  if (!["draft", "rejected"].includes(product.status)) return NextResponse.json({ error: "Only draft or rejected products can be submitted." }, { status: 403 });
  if (!product.title) return NextResponse.json({ error: "Please complete Title before submitting." }, { status: 400 });
  if (!product.price || Number(product.price) <= 0) return NextResponse.json({ error: "Please complete Price before submitting." }, { status: 400 });
  if (product.stock === null || product.stock === undefined || Number(product.stock) < 0) return NextResponse.json({ error: "Please complete Stock before submitting." }, { status: 400 });

  const descriptionData = normaliseDescriptionData(product.description_data);
  if (!descriptionData.overview.length) return NextResponse.json({ error: "Please complete Product Overview before submitting." }, { status: 400 });
  const missingRequiredDetails = ["Colour", "Material", "Assembly"].filter((label) => !descriptionData.details.find((row) => row.label === label)?.value);
  if (missingRequiredDetails.length) return NextResponse.json({ error: "Please complete Colour, Material and Assembly in Details." }, { status: 400 });
  const imageCount = product.product_images?.length ?? Number(body.image_count ?? 0);
  if (imageCount < 1) return NextResponse.json({ error: "Please add at least one product image." }, { status: 400 });

  const descriptionHtml = buildDescriptionHtml(descriptionData);
  const { data, error } = await ctx.supabase
    .from("vendor_products")
    .update({ status: "submitted", submitted_at: new Date().toISOString(), rejection_reason: null, final_description: descriptionHtml, description: descriptionHtml })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await ctx.supabase.from("activity_logs").insert({ user_id: ctx.profile.id, vendor_id: ctx.vendor.id, action: "product_submitted", entity_type: "vendor_products", entity_id: id });
  return NextResponse.json({ product: data });
}

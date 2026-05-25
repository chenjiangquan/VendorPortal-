import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/permissions";
import { buildDescriptionHtml, normaliseDescriptionData, normaliseOverviewLines } from "@/lib/product-description";

type AiOutput = {
  improved_title?: string;
  product_overview?: string[] | string;
  details?: { label?: string; value?: string }[];
  seo_title?: string;
  seo_description?: string;
  tags?: string[];
  google_product_category?: string;
  image_alt_texts?: string[];
};

export async function POST(request: Request) {
  const ctx = await requireAdminApi();
  if ("error" in ctx) return ctx.error;

  const body = await request.json().catch(() => ({}));
  const productId = typeof body.product_id === "string" ? body.product_id : "";
  const output = (body.output ?? {}) as AiOutput;
  if (!productId) return NextResponse.json({ error: "product_id is required" }, { status: 400 });

  const { data: product } = await ctx.supabase.from("vendor_products").select("*, product_images(id,position)").eq("id", productId).single();
  if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });

  const currentDescription = normaliseDescriptionData(product.description_data);
  const overview = Array.isArray(output.product_overview)
    ? output.product_overview.map(String).map((line) => line.trim()).filter(Boolean)
    : typeof output.product_overview === "string"
      ? normaliseOverviewLines(output.product_overview)
      : currentDescription.overview;
  const details = Array.isArray(output.details) && output.details.length
    ? mergeDetails(currentDescription.details, output.details)
    : currentDescription.details;
  const descriptionData = { overview, details };
  const descriptionHtml = buildDescriptionHtml(descriptionData);

  const patch: Record<string, unknown> = {
    description_data: descriptionData,
    final_description: descriptionHtml,
    description: descriptionHtml,
    updated_at: new Date().toISOString()
  };
  if (output.improved_title?.trim()) patch.title = output.improved_title.trim();
  if (output.seo_title?.trim()) patch.seo_title = output.seo_title.trim();
  if (output.seo_description?.trim()) patch.seo_description = output.seo_description.trim();
  if (Array.isArray(output.tags)) patch.tags = output.tags.map(String).map((tag) => tag.trim()).filter(Boolean);
  if (output.google_product_category?.trim()) patch.google_product_category = output.google_product_category.trim();

  const { data, error } = await ctx.supabase.from("vendor_products").update(patch).eq("id", productId).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (Array.isArray(output.image_alt_texts) && output.image_alt_texts.length) {
    const images = [...(product.product_images ?? [])].sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0));
    for (const [index, altText] of output.image_alt_texts.entries()) {
      const image = images[index];
      if (!image || !String(altText).trim()) continue;
      await ctx.supabase.from("product_images").update({ alt_text: String(altText).trim() }).eq("id", image.id).eq("product_id", productId);
    }
  }

  await ctx.supabase.from("activity_logs").insert({
    user_id: ctx.profile.id,
    vendor_id: data.vendor_id,
    action: "ai_product_output_applied",
    entity_type: "vendor_products",
    entity_id: productId
  });

  return NextResponse.json({ product: data, message: "AI output applied successfully." });
}

function mergeDetails(current: { id?: string; label: string; value: string; locked?: boolean }[], incoming: { label?: string; value?: string }[]) {
  const rows = current.map((row) => ({ ...row }));
  for (const item of incoming) {
    const label = String(item.label ?? "").trim();
    const value = String(item.value ?? "").trim();
    if (!label || !value) continue;
    const existing = rows.find((row) => row.label.toLowerCase() === label.toLowerCase());
    if (existing) {
      existing.value = value;
    } else {
      rows.push({ id: `custom-${Date.now()}-${rows.length}`, label, value });
    }
  }
  return rows;
}

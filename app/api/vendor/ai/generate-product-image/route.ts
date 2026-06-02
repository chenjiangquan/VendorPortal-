import { NextResponse } from "next/server";
import { z } from "zod";
import { generateVendorProductImage } from "@/lib/ai";
import { requireVendorApi } from "@/lib/permissions";

const requestSchema = z.object({
  product_id: z.string().uuid().optional().nullable(),
  title: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  target_product_type: z.string().optional().nullable(),
  target_product_description: z.string().optional().nullable(),
  custom_prompt: z.string().max(1000).optional().nullable(),
  mode: z.enum(["studio", "scene", "closeup", "material", "dimensions"]),
  source_image: z.object({
    url: z.string().refine((value) => value.startsWith("data:image/") || /^https?:\/\//.test(value), "Source image must be a valid image URL."),
    storage_path: z.string().optional().nullable(),
    alt_text: z.string().optional().nullable()
  }),
  dimensions: z.object({
    length: z.string().optional().nullable(),
    width: z.string().optional().nullable(),
    height: z.string().optional().nullable()
  }).optional().nullable()
});

export async function POST(request: Request) {
  const ctx = await requireVendorApi();
  if ("error" in ctx) return ctx.error;

  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid AI image request." }, { status: 400 });
  }

  const input = parsed.data;
  if (input.source_image.storage_path && !input.source_image.storage_path.startsWith(`${ctx.vendor.id}/`)) {
    return NextResponse.json({ error: "Source image does not belong to this vendor." }, { status: 403 });
  }

  if (input.mode === "dimensions" && (!input.dimensions?.length?.trim() || !input.dimensions?.width?.trim() || !input.dimensions?.height?.trim())) {
    return NextResponse.json({ error: "Length, width and height are required for dimensions images." }, { status: 400 });
  }

  if (input.product_id) {
    const { data: product } = await ctx.supabase
      .from("vendor_products")
      .select("id,status")
      .eq("id", input.product_id)
      .eq("vendor_id", ctx.vendor.id)
      .single();
    if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });
    if (!["draft", "rejected"].includes(product.status)) {
      return NextResponse.json({ error: "Images can only be generated directly for draft or rejected products." }, { status: 403 });
    }
  }

  try {
    const image = await generateVendorProductImage({
      vendorId: ctx.vendor.id,
      productId: input.product_id,
      sourceImage: input.source_image,
      mode: input.mode,
      title: input.title,
      category: input.category,
      targetProductType: input.target_product_type,
      targetProductDescription: input.target_product_description,
      customPrompt: input.custom_prompt,
      dimensions: input.dimensions ?? undefined
    });
    return NextResponse.json({ image });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "AI image generation failed." }, { status: 400 });
  }
}

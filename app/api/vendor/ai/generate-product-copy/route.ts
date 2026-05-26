import { NextResponse } from "next/server";
import { z } from "zod";
import { generateVendorProductCopy } from "@/lib/ai";
import { requireVendorApi } from "@/lib/permissions";

const imageSchema = z.object({
  url: z.string().refine((value) => value.startsWith("data:image/") || /^https?:\/\//.test(value), "Image must be a valid image URL."),
  storage_path: z.string().optional().nullable(),
  alt_text: z.string().optional().nullable()
});

const requestSchema = z.object({
  title: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  copy_target: z.enum(["title", "overview", "both"]).optional().default("both"),
  target_product_type: z.string().optional().nullable(),
  target_product_description: z.string().optional().nullable(),
  overview: z.string().optional().nullable(),
  details: z.array(z.object({
    id: z.string().optional(),
    label: z.string(),
    value: z.string(),
    locked: z.boolean().optional()
  })).optional(),
  images: z.array(imageSchema).min(1, "Please upload at least one product image before using AI.").max(12)
});

export async function POST(request: Request) {
  const ctx = await requireVendorApi();
  if ("error" in ctx) return ctx.error;

  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid AI request." }, { status: 400 });
  }

  const invalidImage = parsed.data.images.find((image) => image.storage_path && !image.storage_path.startsWith(`${ctx.vendor.id}/`));
  if (invalidImage) {
    return NextResponse.json({ error: "Image does not belong to this vendor." }, { status: 403 });
  }

  try {
    const result = await generateVendorProductCopy({
      ...parsed.data,
      details: parsed.data.details?.map((detail, index) => ({
        id: detail.id ?? `detail-${index}`,
        label: detail.label,
        value: detail.value,
        locked: detail.locked
      }))
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "AI product copy generation failed." }, { status: 400 });
  }
}

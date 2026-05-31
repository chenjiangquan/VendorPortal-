import OpenAI, { toFile } from "openai";
import { createAdminClient } from "@/lib/supabase/admin";
import { DescriptionData } from "@/lib/product-description";

export function safeParseAiJson(text: string) {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function optimiseProduct(productId: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const supabase = createAdminClient();
  const { data: product } = await supabase
    .from("vendor_products")
    .select("*, vendors(company_name), product_images(*)")
    .eq("id", productId)
    .single();
  if (!product) throw new Error("Product not found.");

  const openai = new OpenAI({ apiKey });
  const response = await openai.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content:
          "You write UK English furniture ecommerce copy for Shopify. Do not invent facts. Avoid unsupported warranty, delivery, or exaggerated claims. Return only one valid JSON object. Do not use markdown, code fences, prose, comments, or trailing commas."
      },
      {
        role: "user",
        content: JSON.stringify({
          product,
          required_shape: {
            improved_title: "string",
            product_overview: ["string"],
            details: [{ label: "string", value: "string" }],
            seo_title: "string",
            seo_description: "string",
            tags: ["string"],
            image_alt_texts: ["string"],
            google_product_category: "string"
          },
          fallback_dimensions_text: "Please refer to the product images or contact us for details."
        })
      }
    ]
  });

  const text = response.output_text;
  const parsed = safeParseAiJson(text);
  if (!parsed) {
    console.error("AI returned invalid JSON:", text.slice(0, 500));
    throw new Error("AI returned invalid JSON. Please try again.");
  }

  return parsed;
}

export async function generateVendorProductCopy(input: {
  title?: string | null;
  category?: string | null;
  copy_target?: "title" | "overview" | "both";
  target_product_type?: string | null;
  target_product_description?: string | null;
  overview?: string | null;
  details?: DescriptionData["details"] | null;
  images: { url: string; alt_text?: string | null }[];
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
  if (!input.images.length) throw new Error("Please upload at least one product image before using AI.");

  const openai = new OpenAI({ apiKey });
  const imagesForCopy = input.images.slice(0, 2);
  const response = await openai.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content:
          "Write concise furniture ecommerce copy from the images and details. Return only valid JSON. Do not use markdown or HTML. Do not invent dimensions, materials, warranties, delivery, discounts, brand names, or unsupported claims."
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({
              task: input.copy_target ?? "both",
              output: {
                title: input.copy_target === "overview" ? "empty string" : "original collection-style product name + key colour/material + product type",
                overview: input.copy_target === "title" ? [] : "3-6 short bullet strings, no bullet symbols, under 24 words each"
              },
              product_context: {
                current_title: input.title ?? "",
                category: input.category ?? "",
                target_product_type: input.target_product_type ?? "",
                target_product_description: input.target_product_description ?? "",
                current_overview: input.overview ?? "",
                details: input.details ?? []
              },
              style: "Use names like Ophelia, Greenwich, Laurel, Fulbourn as inspiration only. Do not copy examples or use real brands.",
              rules: "Focus on the target product if provided. Ignore surrounding decor/other furniture. Improve existing title without repeating it exactly. Keep claims visual or detail-based. Return JSON shape: {\"title\":\"\",\"overview\":[\"\"]}."
            })
          },
          ...imagesForCopy.map((image) => ({
            type: "input_image" as const,
            image_url: image.url
          }))
        ]
      }
    ] as any
  });

  const parsed = safeParseAiJson(response.output_text);
  if (!parsed || typeof parsed !== "object") {
    console.error("Vendor AI copy returned invalid JSON:", response.output_text.slice(0, 500));
    throw new Error("AI returned invalid JSON. Please try again.");
  }

  const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
  const overview = Array.isArray((parsed as any).overview)
    ? (parsed as any).overview.map((item: unknown) => String(item).trim()).filter(Boolean).slice(0, 6)
    : [];

  if (!title && !overview.length) {
    throw new Error("AI did not return usable product copy. Please try again.");
  }

  return { title, overview };
}

type VendorImageMode = "studio" | "scene" | "closeup" | "material" | "dimensions";

export async function generateVendorProductImage(input: {
  vendorId: string;
  productId?: string | null;
  sourceImage: { url: string; storage_path?: string | null; alt_text?: string | null };
  mode: VendorImageMode;
  title?: string | null;
  category?: string | null;
  targetProductType?: string | null;
  targetProductDescription?: string | null;
  dimensions?: { length?: string | null; width?: string | null; height?: string | null };
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const sourceFile = await prepareSourceImageFile(input.sourceImage.url);

  const prompt = buildVendorImagePrompt(input);
  const openai = new OpenAI({ apiKey });
  let response;
  try {
    response = await openai.images.edit({
      model: "gpt-image-1",
      image: sourceFile,
      prompt,
      size: "1024x1024",
      quality: "medium",
      output_format: "png",
      input_fidelity: "high"
    });
  } catch (error) {
    throw new Error(friendlyOpenAIImageError(error));
  }

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new Error("AI image generation did not return an image.");

  return {
    id: crypto.randomUUID(),
    url: `data:image/png;base64,${b64}`,
    storage_path: null,
    alt_text: generatedImageAltText(input),
    action: "add" as const,
    is_temporary: true
  };
}

async function prepareSourceImageFile(url: string) {
  const sourceResponse = await fetch(url);
  if (!sourceResponse.ok) throw new Error("Could not read source product image. Please re-upload the image and try again.");

  const bytes = Buffer.from(await sourceResponse.arrayBuffer());
  if (!bytes.length) throw new Error("The selected source image is empty. Please choose another image.");
  if (bytes.length > 20 * 1024 * 1024) throw new Error("The selected source image is too large for AI image generation. Please upload an image under 20MB.");

  const detected = detectSupportedImage(bytes, sourceResponse.headers.get("content-type"));
  if (!detected) {
    throw new Error("This image cannot be used for AI image generation. Please upload a standard JPG, PNG or WebP image and try again.");
  }

  return toFile(bytes, `source.${detected.extension}`, { type: detected.mimeType });
}

function buildVendorImagePrompt(input: {
  mode: VendorImageMode;
  title?: string | null;
  category?: string | null;
  targetProductType?: string | null;
  targetProductDescription?: string | null;
  dimensions?: { length?: string | null; width?: string | null; height?: string | null };
}) {
  const productContext = [
    input.title ? `Product title/context: ${input.title}.` : "",
    input.category ? `Category: ${input.category}.` : "",
    input.targetProductType ? `Target product type: ${input.targetProductType}.` : "",
    input.targetProductDescription ? `Target product to focus on: ${input.targetProductDescription}.` : ""
  ].filter(Boolean).join("\n");
  const sharedRules = [
    "Use the input image as the exact product reference.",
    input.targetProductType || input.targetProductDescription
      ? "If the image contains multiple products, focus only on the target product described above. Ignore other furniture, decor, artwork, lighting, plants and room accessories."
      : "If the image contains multiple products, use the main furniture product as the reference unless a target product is described.",
    "Preserve the product shape, colour, material, proportions, silhouette, legs, arms, stitching and visible construction.",
    "Do not redesign the product. Do not add logos, text overlays, labels, watermarks, fake sale badges or extra products.",
    "Create a realistic ecommerce image suitable for a furniture product page.",
    "Keep the product clearly visible and commercially polished."
  ].join("\n");

  const modePrompts: Record<VendorImageMode, string> = {
    studio: "Create a clean studio product photo on a warm off-white background with soft shadow, front three-quarter view, product fully visible, premium catalogue style.",
    scene: "Create a realistic lifestyle scene in a bright modern home interior with neutral styling, natural daylight, tasteful decor and the product as the main focus.",
    closeup: "Create a close-up detail image focusing on the most distinctive product feature, such as upholstery, stitching, frame, cushion shape or surface finish.",
    material: "Create a macro material/detail image showing texture, grain, weave, leather, fabric or surface finish. Keep it realistic and based on the source product.",
    dimensions: `Create a clean product dimensions image on a light neutral background. Show the full product with clear measurement guide lines and readable labels. Use these exact dimensions: Length ${input.dimensions?.length}, Width ${input.dimensions?.width}, Height ${input.dimensions?.height}. Do not invent other measurements.`
  };

  return [productContext, sharedRules, modePrompts[input.mode]].filter(Boolean).join("\n\n");
}

function generatedImageAltText(input: { mode: VendorImageMode; title?: string | null }) {
  const label: Record<VendorImageMode, string> = {
    studio: "studio product image",
    scene: "lifestyle scene image",
    closeup: "close-up product detail image",
    material: "material detail image",
    dimensions: "product dimensions image"
  };
  return `${input.title ?? "Product"} ${label[input.mode]}`.trim();
}

function detectSupportedImage(bytes: Buffer, contentType: string | null) {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mimeType: "image/png", extension: "png" };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mimeType: "image/jpeg", extension: "jpg" };
  }
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") {
    return { mimeType: "image/webp", extension: "webp" };
  }

  const type = contentType?.split(";")[0]?.trim().toLowerCase();
  if (type === "image/png") return { mimeType: "image/png", extension: "png" };
  if (type === "image/jpeg" || type === "image/jpg") return { mimeType: "image/jpeg", extension: "jpg" };
  if (type === "image/webp") return { mimeType: "image/webp", extension: "webp" };
  return null;
}

function friendlyOpenAIImageError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const lower = message.toLowerCase();
  if (lower.includes("invalid image") || lower.includes("image file") || lower.includes("image mode") || lower.includes("unsupported image")) {
    return "This image cannot be used for AI image generation. Please re-upload a standard JPG, PNG or WebP image, then try again.";
  }
  if (lower.includes("too large") || lower.includes("maximum")) {
    return "The selected image is too large for AI image generation. Please upload a smaller image and try again.";
  }
  return "AI image generation failed. Please try another source image.";
}

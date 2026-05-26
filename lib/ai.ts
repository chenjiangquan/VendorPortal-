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
  const response = await openai.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content:
          "You write concise furniture ecommerce copy for a vendor product upload form. Analyse the product images and any provided structured details. Return only one valid JSON object. Do not use markdown, code fences, prose, comments, or trailing commas. Do not invent dimensions, materials, warranties, delivery promises, real brand names, or unsupported claims. If uncertain, keep wording general and visual-observation based. Use clear modern ecommerce language."
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({
              current_title: input.title ?? "",
              category: input.category ?? "",
              copy_target: input.copy_target ?? "both",
              target_product_type: input.target_product_type ?? "",
              target_product_description: input.target_product_description ?? "",
              current_overview: input.overview ?? "",
              details: input.details ?? [],
              required_shape: {
                title: input.copy_target === "overview" ? "omit or empty string" : "string, ecommerce-ready product title with an original product/collection name, colour/material and product type",
                overview: input.copy_target === "title" ? "omit or empty array" : ["3-6 short Amazon-style bullet point strings, each under 24 words"]
              },
              title_style_examples_do_not_copy: [
                "Ophelia Taupe Boucle Dining Chair",
                "Greenwich Light Taupe Boucle Dining Chair",
                "Laurel Wave Taupe Boucle Set of 2 Dining Chairs",
                "Fulbourn Taupe Boucle Dining Chair with Natural Wood Frame"
              ],
              rules: [
                "Create a tasteful original product name or collection name, then add the most useful colour/material and product type.",
                "If copy_target is title, only generate title and leave overview empty.",
                "If copy_target is overview, only generate overview and leave title empty.",
                "If target_product_type or target_product_description is provided, focus only on that product in the images.",
                "Ignore other products, chairs, tables, vases, decor, artwork, lighting, windows and room styling unless they are the stated target product.",
                "Do not use real brand names or copy the examples exactly.",
                "Avoid generic titles like 'Mid-Century Brown Upholstered Dining Chair'.",
                "If current_title exists, do not repeat it exactly; improve it.",
                "Title should be specific but not exaggerated.",
                "Overview should be Amazon-style benefits/features bullets and describe visible product type, style, likely use, and provided details only.",
                "Overview strings should not include bullet symbols; the UI will add bullets.",
                "Do not mention dimensions unless supplied in details.",
                "Do not mention warranty, shipping speed, discounts, or guarantees.",
                "Do not output HTML."
              ]
            })
          },
          ...input.images.slice(0, 4).map((image) => ({
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

  const sourceResponse = await fetch(input.sourceImage.url);
  if (!sourceResponse.ok) throw new Error("Could not read source product image.");

  const contentType = sourceResponse.headers.get("content-type") ?? "image/png";
  const bytes = Buffer.from(await sourceResponse.arrayBuffer());
  const sourceFile = await toFile(bytes, `source.${extensionFromContentType(contentType)}`, { type: contentType });

  const prompt = buildVendorImagePrompt(input);
  const openai = new OpenAI({ apiKey });
  const response = await openai.images.edit({
    model: "gpt-image-1",
    image: sourceFile,
    prompt,
    size: "1024x1024",
    quality: "medium",
    output_format: "png",
    input_fidelity: "high"
  });

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

function extensionFromContentType(contentType: string) {
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  return "png";
}

import OpenAI from "openai";
import { createAdminClient } from "@/lib/supabase/admin";

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

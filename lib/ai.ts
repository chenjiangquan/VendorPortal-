import OpenAI from "openai";
import { createAdminClient } from "@/lib/supabase/admin";

export async function optimiseProduct(productId: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY.");

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
          "You write UK English furniture ecommerce copy for Shopify. Do not invent facts. Avoid unsupported warranty, delivery, or exaggerated claims. Return strict JSON only."
      },
      {
        role: "user",
        content: JSON.stringify({
          product,
          required_shape: {
            improved_title: "string",
            product_description_html: "string",
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
  return JSON.parse(text);
}

import { createAdminClient } from "@/lib/supabase/admin";
import { buildDescriptionHtml } from "@/lib/product-description";
import type { ShopifyTokenSetting } from "@/lib/shopify-oauth";
import { numericIdFromGid, shopifyAdminProductUrl } from "@/lib/utils";

type ShopifyError = { message: string };

export async function shopifyGraphQL<T>(query: string, variables?: Record<string, unknown>) {
  const connection = await getShopifyConnection();
  const domain = connection.shop;
  const token = connection.access_token;
  const version = process.env.SHOPIFY_API_VERSION ?? "2026-01";

  const res = await fetch(`https://${domain}/admin/api/${version}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store"
  });

  const json = (await res.json()) as { data?: T; errors?: ShopifyError[] };
  if (!res.ok || json.errors?.length) {
    throw new Error(json.errors?.map((error) => error.message).join(", ") || "Shopify request failed.");
  }

  return json.data as T;
}

export async function getShopifyConnection() {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("app_settings").select("value").eq("key", "shopify_access_token").single();
  const value = data?.value as ShopifyTokenSetting | null | undefined;

  if (error || !value?.access_token || !value?.shop) {
    throw new Error("Shopify app is not connected. Please install the app from Admin Settings.");
  }

  return value;
}

const PRODUCT_CREATE = `
mutation ProductCreate($input: ProductInput!, $media: [CreateMediaInput!]) {
  productCreate(input: $input, media: $media) {
    product {
      id
      legacyResourceId
      title
      status
      variants(first: 1) {
        nodes {
          id
          legacyResourceId
        }
      }
    }
    userErrors {
      field
      message
    }
  }
}`;

export async function createShopifyDraftProduct(productId: string) {
  const supabase = createAdminClient();
  const { data: product, error } = await supabase
    .from("vendor_products")
    .select("*, vendors(*), product_images(*), product_variants(*)")
    .eq("id", productId)
    .single();

  if (error || !product) throw new Error("Product not found.");
  if (product.shopify_product_gid) {
    return { alreadyExists: true, productGid: product.shopify_product_gid, adminUrl: shopifyAdminProductUrl(product.shopify_product_gid) };
  }
  if (product.status !== "approved") throw new Error("Only approved products can be created in Shopify.");

  const vendorName = product.vendors?.shopify_vendor_name || product.vendors?.company_name || "Vendor Portal";
  const tags = Array.from(
    new Set([
      "source_vendor_portal",
      `vendor_id:${product.vendor_id}`,
      `vendor:${vendorName}`,
      product.category,
      product.product_type,
      ...(product.tags ?? [])
    ].filter(Boolean))
  );

  const metafields = [
    { namespace: "vendor_portal", key: "vendor_id", value: product.vendor_id, type: "single_line_text_field" },
    { namespace: "vendor_portal", key: "product_id", value: product.id, type: "single_line_text_field" },
    product.lead_time ? { namespace: "vendor_portal", key: "lead_time", value: product.lead_time, type: "single_line_text_field" } : null,
    product.material ? { namespace: "vendor_portal", key: "material", value: product.material, type: "single_line_text_field" } : null,
    product.dimensions ? { namespace: "vendor_portal", key: "dimensions", value: product.dimensions, type: "single_line_text_field" } : null
  ].filter(Boolean);

  const variants = product.product_variants?.length
    ? product.product_variants.map((variant: Record<string, unknown>) => ({
        price: String(variant.price ?? product.price),
        sku: variant.sku || product.sku || undefined,
        barcode: variant.barcode || undefined,
        options: [variant.option1_value || "Default Title", variant.option2_value, variant.option3_value].filter(Boolean)
      }))
    : [{ price: String(product.price), sku: product.sku || undefined, barcode: product.barcode || undefined }];
  const structuredDescriptionHtml = buildDescriptionHtml(product.description_data);

  const data = await shopifyGraphQL<{
    productCreate: {
      product: { id: string; legacyResourceId: string; variants: { nodes: { id: string; legacyResourceId: string }[] } } | null;
      userErrors: { message: string }[];
    };
  }>(PRODUCT_CREATE, {
    input: {
      title: product.title,
      descriptionHtml: structuredDescriptionHtml || product.final_description || product.ai_description || product.description || "",
      vendor: vendorName,
      productType: product.product_type || undefined,
      tags,
      status: "DRAFT",
      // TODO: Shopify's newest product options APIs may require a follow-up mutation for full option metadata.
      // Version 1 stores Shopify-like options locally and sends variant option values in the simple productCreate payload.
      seo: {
        title: product.seo_title || product.title,
        description: product.seo_description || undefined
      },
      metafields,
      variants
    },
    media: (product.product_images ?? []).map((image: Record<string, unknown>) => ({
      mediaContentType: "IMAGE",
      originalSource: image.url,
      alt: image.alt_text || product.title
    }))
  });

  const userErrors = data.productCreate.userErrors;
  if (userErrors.length) throw new Error(userErrors.map((item) => item.message).join(", "));

  const shopifyProduct = data.productCreate.product;
  if (!shopifyProduct) throw new Error("Shopify did not return a product.");
  const firstVariant = shopifyProduct.variants.nodes[0];

  await supabase
    .from("vendor_products")
    .update({
      status: "shopify_draft",
      shopify_status: "DRAFT",
      shopify_product_gid: shopifyProduct.id,
      shopify_product_id: shopifyProduct.legacyResourceId ?? numericIdFromGid(shopifyProduct.id),
      shopify_variant_gid: firstVariant?.id ?? null,
      shopify_variant_id: firstVariant?.legacyResourceId ?? numericIdFromGid(firstVariant?.id),
      shopify_created_at: new Date().toISOString()
    })
    .eq("id", product.id);

  await supabase.from("activity_logs").insert({
    vendor_id: product.vendor_id,
    action: "shopify_draft_created",
    entity_type: "vendor_products",
    entity_id: product.id,
    metadata: { shopify_product_gid: shopifyProduct.id }
  });

  return { alreadyExists: false, productGid: shopifyProduct.id, adminUrl: shopifyAdminProductUrl(shopifyProduct.id) };
}

export function getShopifyProductAdminUrl(productGid: string) {
  return shopifyAdminProductUrl(productGid);
}

export async function createShopifyFulfillmentFromTracking(trackingSubmissionId: string) {
  if (process.env.AUTO_FULFILLMENT_ENABLED !== "true") {
    return { skipped: true, reason: "AUTO_FULFILLMENT_ENABLED is not true", trackingSubmissionId };
  }
  // TODO: Resolve fulfillment orders and call fulfillmentCreate once the manual review flow is replaced.
  throw new Error("Automatic fulfillment is intentionally disabled in version 1.");
}

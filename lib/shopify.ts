import { createAdminClient } from "@/lib/supabase/admin";
import { buildDescriptionHtml } from "@/lib/product-description";
import type { ShopifyTokenSetting } from "@/lib/shopify-oauth";
import { numericIdFromGid, shopifyAdminProductUrl } from "@/lib/utils";

type ShopifyError = { message: string };

export class ShopifyDraftCreationError extends Error {
  details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = "ShopifyDraftCreationError";
    this.details = details;
  }
}

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
mutation ProductCreate($input: ProductInput!) {
  productCreate(input: $input) {
    product {
      id
      legacyResourceId
      title
      handle
      status
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
  if (product.status !== "submitted") throw new Error("Only submitted products can be created in Shopify.");

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

  const structuredDescriptionHtml = buildDescriptionHtml(product.description_data);
  const hasLocalVariants = Boolean(product.product_variants?.length);

  let data: {
    productCreate: {
      product: { id: string; legacyResourceId: string; title: string; handle: string; status: string } | null;
      userErrors: { field?: string[]; message: string }[];
    };
  };

  try {
    data = await shopifyGraphQL<typeof data>(PRODUCT_CREATE, {
      input: {
        title: product.title,
        descriptionHtml: structuredDescriptionHtml || product.final_description || product.ai_description || product.description || "",
        vendor: vendorName,
        productType: product.product_type || undefined,
        tags,
        status: "DRAFT",
        seo: {
          title: product.seo_title || product.title,
          description: product.seo_description || undefined
        },
        metafields
      }
    });
  } catch (error) {
    throw new ShopifyDraftCreationError("Shopify draft creation failed.", error instanceof Error ? error.message : error);
  }

  const userErrors = data.productCreate.userErrors;
  if (userErrors.length) throw new ShopifyDraftCreationError("Shopify draft creation failed.", userErrors);

  const shopifyProduct = data.productCreate.product;
  if (!shopifyProduct) throw new Error("Shopify did not return a product.");

  await supabase
    .from("vendor_products")
    .update({
      status: "shopify_draft",
      shopify_status: "DRAFT",
      shopify_product_gid: shopifyProduct.id,
      shopify_product_id: shopifyProduct.legacyResourceId ?? numericIdFromGid(shopifyProduct.id),
      shopify_variant_gid: null,
      shopify_variant_id: null,
      shopify_created_at: new Date().toISOString()
    })
    .eq("id", product.id);

  await supabase.from("activity_logs").insert({
    vendor_id: product.vendor_id,
    action: "shopify_draft_created",
    entity_type: "vendor_products",
    entity_id: product.id,
    metadata: {
      shopify_product_gid: shopifyProduct.id,
      variants_sync_warning: hasLocalVariants ? "Variants were saved in Vendor Portal but may need manual setup in Shopify." : null
    }
  });

  return {
    alreadyExists: false,
    productGid: shopifyProduct.id,
    adminUrl: shopifyAdminProductUrl(shopifyProduct.id),
    warning: hasLocalVariants ? "Variants were saved in Vendor Portal but may need manual setup in Shopify." : undefined
  };
}

const PRODUCT_UPDATE = `
mutation ProductUpdate($input: ProductInput!) {
  productUpdate(input: $input) {
    product {
      id
      legacyResourceId
      title
      handle
      status
    }
    userErrors {
      field
      message
    }
  }
}`;

export async function updateShopifyDraftProduct(productId: string) {
  const supabase = createAdminClient();
  const { data: product, error } = await supabase
    .from("vendor_products")
    .select("*, vendors(*)")
    .eq("id", productId)
    .single();

  if (error || !product) throw new Error("Product not found.");
  if (!product.shopify_product_gid) return { skipped: true, reason: "No Shopify product is linked." };

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
  const descriptionHtml = buildDescriptionHtml(product.description_data) || product.final_description || product.ai_description || product.description || "";

  let data: {
    productUpdate: {
      product: { id: string; legacyResourceId: string; status: string } | null;
      userErrors: { field?: string[]; message: string }[];
    };
  };

  try {
    data = await shopifyGraphQL<typeof data>(PRODUCT_UPDATE, {
      input: {
        id: product.shopify_product_gid,
        title: product.title,
        descriptionHtml,
        vendor: vendorName,
        productType: product.product_type || undefined,
        tags,
        seo: {
          title: product.seo_title || product.title,
          description: product.seo_description || undefined
        }
      }
    });
  } catch (error) {
    throw new ShopifyDraftCreationError("Shopify product update failed.", error instanceof Error ? error.message : error);
  }

  if (data.productUpdate.userErrors.length) {
    throw new ShopifyDraftCreationError("Shopify product update failed.", data.productUpdate.userErrors);
  }

  return { updated: true, warning: product.has_variants ? "Variants were saved in Vendor Portal but may need manual review in Shopify." : undefined };
}

export async function archiveShopifyProduct(productId: string) {
  const supabase = createAdminClient();
  const { data: product, error } = await supabase.from("vendor_products").select("*").eq("id", productId).single();
  if (error || !product) throw new Error("Product not found.");
  if (!product.shopify_product_gid) return { skipped: true, reason: "No Shopify product is linked." };

  try {
    const data = await shopifyGraphQL<{
      productUpdate: {
        product: { id: string; legacyResourceId: string; status: string } | null;
        userErrors: { field?: string[]; message: string }[];
      };
    }>(PRODUCT_UPDATE, {
      input: {
        id: product.shopify_product_gid,
        status: "ARCHIVED"
      }
    });
    if (data.productUpdate.userErrors.length) {
      throw new ShopifyDraftCreationError("Shopify product archive failed.", data.productUpdate.userErrors);
    }
    return { archived: true };
  } catch (error) {
    if (error instanceof ShopifyDraftCreationError) throw error;
    throw new ShopifyDraftCreationError("Shopify product archive failed.", error instanceof Error ? error.message : error);
  }
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

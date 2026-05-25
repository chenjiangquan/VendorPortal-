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
mutation ProductCreate($input: ProductInput!, $media: [CreateMediaInput!]) {
  productCreate(input: $input, media: $media) {
    product {
      id
      legacyResourceId
      title
      handle
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

const PRODUCT_VARIANTS_BULK_UPDATE = `
mutation ProductVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
  productVariantsBulkUpdate(productId: $productId, variants: $variants) {
    product {
      id
    }
    productVariants {
      id
      legacyResourceId
      price
      compareAtPrice
    }
    userErrors {
      field
      message
    }
  }
}`;

const PRODUCT_VARIANTS_BULK_CREATE = `
mutation ProductVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
  productVariantsBulkCreate(productId: $productId, variants: $variants) {
    product {
      id
    }
    productVariants {
      id
      legacyResourceId
      title
      price
      compareAtPrice
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
  const warnings: string[] = [];
  const media = (product.product_images ?? [])
    .filter((image: Record<string, unknown>) => typeof image.url === "string" && image.url.startsWith("https://"))
    .sort((a: Record<string, unknown>, b: Record<string, unknown>) => Number(a.position ?? 0) - Number(b.position ?? 0))
    .map((image: Record<string, unknown>) => ({
      mediaContentType: "IMAGE",
      originalSource: image.url,
      alt: image.alt_text || product.title
    }));

  let data: {
    productCreate: {
      product: {
        id: string;
        legacyResourceId: string;
        title: string;
        handle: string;
        status: string;
        variants: { nodes: { id: string; legacyResourceId: string }[] };
      } | null;
      userErrors: { field?: string[]; message: string }[];
    };
  };

  const productCreateInput = {
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
  };

  try {
    data = await shopifyGraphQL<typeof data>(PRODUCT_CREATE, {
      input: productCreateInput,
      media
    });
  } catch (error) {
    if (media.length) {
      warnings.push("Shopify Draft created, but some images failed to sync.");
      data = await shopifyGraphQL<typeof data>(PRODUCT_CREATE, {
        input: productCreateInput,
        media: []
      });
    } else {
      throw new ShopifyDraftCreationError("Shopify draft creation failed.", error instanceof Error ? error.message : error);
    }
  }

  const userErrors = data.productCreate.userErrors;
  if (userErrors.length) {
    const mediaRelated = media.length && userErrors.some((error) => error.field?.some((field) => String(field).includes("media")));
    if (mediaRelated) {
      warnings.push("Shopify Draft created, but some images failed to sync.");
      data = await shopifyGraphQL<typeof data>(PRODUCT_CREATE, {
        input: productCreateInput,
        media: []
      });
    } else {
      throw new ShopifyDraftCreationError("Shopify draft creation failed.", userErrors);
    }
  }
  if (data.productCreate.userErrors.length) throw new ShopifyDraftCreationError("Shopify draft creation failed.", data.productCreate.userErrors);

  const shopifyProduct = data.productCreate.product;
  if (!shopifyProduct) throw new Error("Shopify did not return a product.");
  const defaultVariant = shopifyProduct.variants.nodes[0];

  let firstVariantGid = defaultVariant?.id ?? null;
  let firstVariantLegacyId = defaultVariant?.legacyResourceId ?? null;

  if (defaultVariant?.id) {
    const updateResult = await updateDefaultVariant(defaultVariant.id, shopifyProduct.id, product);
    if (updateResult.warning) warnings.push(updateResult.warning);
  } else {
    warnings.push("Default variant price could not be synced because Shopify did not return a default variant.");
  }

  if (hasLocalVariants) {
    const variantResult = await createShopifyVariants(shopifyProduct.id, product);
    if (variantResult.warning) warnings.push(variantResult.warning);
    if (variantResult.firstVariantGid) {
      firstVariantGid = variantResult.firstVariantGid;
      firstVariantLegacyId = variantResult.firstVariantLegacyId;
    }
  }

  if (hasLocalVariants) {
    warnings.push("Inventory quantities for variants may need manual review in Shopify.");
  }

  await supabase
    .from("vendor_products")
    .update({
      status: "shopify_draft",
      shopify_status: "DRAFT",
      shopify_product_gid: shopifyProduct.id,
      shopify_product_id: shopifyProduct.legacyResourceId ?? numericIdFromGid(shopifyProduct.id),
      shopify_variant_gid: firstVariantGid,
      shopify_variant_id: firstVariantLegacyId ?? numericIdFromGid(firstVariantGid),
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
      warnings
    }
  });

  return {
    success: true,
    alreadyExists: false,
    productGid: shopifyProduct.id,
    shopifyProductGid: shopifyProduct.id,
    shopifyProductId: shopifyProduct.legacyResourceId ?? numericIdFromGid(shopifyProduct.id),
    adminUrl: shopifyAdminProductUrl(shopifyProduct.id),
    warnings
  };
}

async function updateDefaultVariant(variantId: string, productId: string, product: Record<string, any>) {
  try {
    const data = await shopifyGraphQL<{
      productVariantsBulkUpdate: {
        productVariants: { id: string; legacyResourceId: string }[];
        userErrors: { field?: string[]; message: string }[];
      };
    }>(PRODUCT_VARIANTS_BULK_UPDATE, {
      productId,
      variants: [
        cleanObject({
          id: variantId,
          price: money(product.price),
          compareAtPrice: product.compare_at_price ? money(product.compare_at_price) : undefined,
          barcode: product.barcode || undefined,
          inventoryItem: product.sku ? { sku: product.sku } : undefined
        })
      ]
    });
    if (data.productVariantsBulkUpdate.userErrors.length) {
      return { warning: `Default variant price/SKU sync failed: ${formatUserErrors(data.productVariantsBulkUpdate.userErrors)}` };
    }
    return {};
  } catch (error) {
    return { warning: `Default variant price/SKU sync failed: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}

async function createShopifyVariants(productId: string, product: Record<string, any>) {
  const variants = (product.product_variants ?? []).map((variant: Record<string, any>) => {
    const optionValues = [
      variant.option1_value ? { optionName: variant.option1_name || "Title", name: variant.option1_value } : null,
      variant.option2_value ? { optionName: variant.option2_name || "Option 2", name: variant.option2_value } : null,
      variant.option3_value ? { optionName: variant.option3_name || "Option 3", name: variant.option3_value } : null
    ].filter(Boolean);
    return cleanObject({
      optionValues: optionValues.length ? optionValues : [{ optionName: "Title", name: "Default Title" }],
      price: money(variant.price ?? product.price),
      compareAtPrice: variant.compare_at_price ? money(variant.compare_at_price) : undefined,
      barcode: variant.barcode || undefined,
      inventoryItem: variant.sku ? { sku: variant.sku } : product.sku ? { sku: product.sku } : undefined
    });
  });

  if (!variants.length) return {};

  try {
    const data = await shopifyGraphQL<{
      productVariantsBulkCreate: {
        productVariants: { id: string; legacyResourceId: string; title: string }[];
        userErrors: { field?: string[]; message: string }[];
      };
    }>(PRODUCT_VARIANTS_BULK_CREATE, { productId, variants });
    if (data.productVariantsBulkCreate.userErrors.length) {
      return { warning: `Variants may need manual review in Shopify: ${formatUserErrors(data.productVariantsBulkCreate.userErrors)}` };
    }
    const firstVariant = data.productVariantsBulkCreate.productVariants[0];
    return { firstVariantGid: firstVariant?.id ?? null, firstVariantLegacyId: firstVariant?.legacyResourceId ?? null };
  } catch (error) {
    return { warning: `Variants may need manual review in Shopify: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}

function money(value: unknown) {
  return Number(value ?? 0).toFixed(2);
}

function cleanObject<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>;
}

function formatUserErrors(errors: { field?: string[]; message: string }[]) {
  return errors.map((error) => `${error.field?.join(".") ? `${error.field.join(".")}: ` : ""}${error.message}`).join("; ");
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

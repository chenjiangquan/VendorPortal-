import { createAdminClient } from "@/lib/supabase/admin";
import { buildDescriptionHtml } from "@/lib/product-description";
import type { ShopifyTokenSetting } from "@/lib/shopify-oauth";
import { numericIdFromGid, shopifyAdminProductUrl } from "@/lib/utils";

type ShopifyError = { message: string };
type ShopifyInventoryVariant = {
  id: string;
  title: string;
  sku?: string | null;
  selectedOptions?: { name: string; value: string }[];
  inventoryItem?: { id: string; tracked: boolean } | null;
};

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
  const version = process.env.SHOPIFY_API_VERSION ?? "2026-04";

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
          sku
          title
          inventoryItem {
            id
            tracked
          }
        }
      }
    }
    userErrors {
      field
      message
    }
  }
}`;

const TAXONOMY_CATEGORY_SEARCH = `
query TaxonomyCategorySearch($query: String!) {
  taxonomy {
    categories(first: 10, search: $query) {
      nodes {
        id
        name
        fullName
        isLeaf
      }
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
      sku
      title
      inventoryItem {
        id
        tracked
      }
      selectedOptions {
        name
        value
      }
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
      sku
      inventoryItem {
        id
        tracked
      }
      selectedOptions {
        name
        value
      }
    }
    userErrors {
      field
      message
    }
  }
}`;

const PRODUCT_OPTIONS_CREATE = `
mutation ProductOptionsCreate($productId: ID!, $options: [OptionCreateInput!]!, $variantStrategy: ProductOptionCreateVariantStrategy) {
  productOptionsCreate(productId: $productId, options: $options, variantStrategy: $variantStrategy) {
    product {
      id
      options {
        id
        name
        position
        values
        optionValues {
          id
          name
          hasVariants
        }
      }
    }
    userErrors {
      field
      message
      code
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
    product.dimensions ? { namespace: "vendor_portal", key: "dimensions", value: product.dimensions, type: "single_line_text_field" } : null,
    product.category ? { namespace: "vendor_portal", key: "category", value: product.category, type: "single_line_text_field" } : null
  ].filter(Boolean);

  const structuredDescriptionHtml = buildDescriptionHtml(product.description_data);
  const hasLocalVariants = Boolean(product.has_variants && product.product_variants?.length);
  if (hasLocalVariants) validateLocalVariants(product);
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
        variants: { nodes: { id: string; legacyResourceId: string; title: string; sku?: string | null; inventoryItem?: { id: string; tracked: boolean } | null }[] };
      } | null;
      userErrors: { field?: string[]; message: string }[];
    };
  };

  const categoryResult = await resolveShopifyCategoryId(product.category, product.shopify_category_id);
  if (categoryResult.warning) warnings.push(categoryResult.warning);

  const productCreateInput = cleanObject({
    title: product.title,
    descriptionHtml: structuredDescriptionHtml || product.final_description || product.ai_description || product.description || "",
    vendor: vendorName,
    productType: product.product_type || undefined,
    category: categoryResult.categoryId || undefined,
    tags,
    status: "DRAFT",
    seo: {
      title: product.seo_title || product.title,
      description: product.seo_description || undefined
    },
    metafields
  });

  try {
    data = await createProductWithCategoryFallback(productCreateInput, media, warnings);
  } catch (error) {
    if (media.length) {
      warnings.push("Shopify Draft created, but some images failed to sync.");
      data = await createProductWithCategoryFallback(productCreateInput, [], warnings);
    } else {
      throw new ShopifyDraftCreationError("Shopify draft creation failed.", error instanceof Error ? error.message : error);
    }
  }

  const userErrors = data.productCreate.userErrors;
  if (userErrors.length) {
    const mediaRelated = media.length && userErrors.some((error) => error.field?.some((field) => String(field).includes("media")));
    if (mediaRelated) {
      warnings.push("Shopify Draft created, but some images failed to sync.");
      data = await createProductWithCategoryFallback(productCreateInput, [], warnings);
    } else {
      throw new ShopifyDraftCreationError("Shopify draft creation failed.", userErrors);
    }
  }
  if (data.productCreate.userErrors.length) throw new ShopifyDraftCreationError("Shopify draft creation failed.", data.productCreate.userErrors);

  const shopifyProduct = data.productCreate.product;
  if (!shopifyProduct) throw new Error("Shopify did not return a product.");
  const defaultVariant = shopifyProduct.variants.nodes[0];

  let firstVariantGid: string | null = defaultVariant?.id ?? null;
  let firstVariantLegacyId: string | null = defaultVariant?.legacyResourceId ?? null;

  if (defaultVariant?.id && !hasLocalVariants) {
    const updateResult = await updateDefaultVariant(defaultVariant.id, shopifyProduct.id, product);
    if (updateResult.warning) warnings.push(updateResult.warning);
  } else if (!defaultVariant?.id) {
    warnings.push("Default variant price could not be synced because Shopify did not return a default variant.");
  }

  if (hasLocalVariants) {
    const variantResult = await syncShopifyVariantsForProduct(product, shopifyProduct.id, defaultVariant?.id);
    warnings.push(...variantResult.warnings);
    if (variantResult.firstVariantGid) {
      firstVariantGid = variantResult.firstVariantGid;
      firstVariantLegacyId = variantResult.firstVariantLegacyId;
    }
  }

  const inventoryResult = hasLocalVariants
    ? { warnings: [], defaultInventoryItemId: null }
    : await syncProductInventory({
        productId: product.id,
        shopifyProductId: shopifyProduct.id,
        defaultVariant,
        product
      });
  warnings.push(...inventoryResult.warnings);

  await supabase
    .from("vendor_products")
    .update({
      status: "shopify_draft",
      shopify_status: "DRAFT",
      shopify_product_gid: shopifyProduct.id,
      shopify_product_id: shopifyProduct.legacyResourceId ?? numericIdFromGid(shopifyProduct.id),
      shopify_variant_gid: firstVariantGid,
      shopify_variant_id: firstVariantLegacyId ?? numericIdFromGid(firstVariantGid),
      shopify_inventory_item_gid: inventoryResult.defaultInventoryItemId ?? null,
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

async function createProductWithCategoryFallback(input: Record<string, unknown>, media: unknown[], warnings: string[]) {
  try {
    const data = await shopifyGraphQL<{
      productCreate: {
        product: {
          id: string;
          legacyResourceId: string;
          title: string;
          handle: string;
          status: string;
          variants: { nodes: { id: string; legacyResourceId: string; title: string; sku?: string | null; inventoryItem?: { id: string; tracked: boolean } | null }[] };
        } | null;
        userErrors: { field?: string[]; message: string }[];
      };
    }>(PRODUCT_CREATE, { input, media });
    if ("category" in input && hasCategoryUserError(data.productCreate.userErrors)) {
      warnings.push("Category was saved in Vendor Portal but may need manual review in Shopify.");
      const { category: _category, ...fallbackInput } = input;
      return shopifyGraphQL<{
        productCreate: {
          product: {
            id: string;
            legacyResourceId: string;
            title: string;
            handle: string;
            status: string;
            variants: { nodes: { id: string; legacyResourceId: string; title: string; sku?: string | null; inventoryItem?: { id: string; tracked: boolean } | null }[] };
          } | null;
          userErrors: { field?: string[]; message: string }[];
        };
      }>(PRODUCT_CREATE, { input: fallbackInput, media });
    }
    return data;
  } catch (error) {
    if ("category" in input && isCategoryInputError(error)) {
      warnings.push("Category was saved in Vendor Portal but may need manual review in Shopify.");
      const { category: _category, ...fallbackInput } = input;
      return shopifyGraphQL<{
        productCreate: {
          product: {
            id: string;
            legacyResourceId: string;
            title: string;
            handle: string;
            status: string;
            variants: { nodes: { id: string; legacyResourceId: string; title: string; sku?: string | null; inventoryItem?: { id: string; tracked: boolean } | null }[] };
          } | null;
          userErrors: { field?: string[]; message: string }[];
        };
      }>(PRODUCT_CREATE, { input: fallbackInput, media });
    }
    throw error;
  }
}

async function resolveShopifyCategoryId(category?: string | null, storedCategoryId?: string | null) {
  if (storedCategoryId?.startsWith("gid://shopify/TaxonomyCategory/")) return { categoryId: storedCategoryId };
  if (!category) return {};

  const supabase = createAdminClient();
  const cacheKey = `shopify_taxonomy_category:${category}`;
  const { data: cached } = await supabase.from("app_settings").select("value").eq("key", cacheKey).maybeSingle();
  const cachedValue = cached?.value as { categoryId?: string } | null;
  if (cachedValue?.categoryId) return { categoryId: cachedValue.categoryId };

  try {
    const leafName = category.split(">").pop()?.trim() || category;
    const data = await shopifyGraphQL<{
      taxonomy: { categories: { nodes: { id: string; fullName: string; name: string; isLeaf: boolean }[] } };
    }>(TAXONOMY_CATEGORY_SEARCH, { query: leafName });
    const nodes = data.taxonomy.categories.nodes;
    const exact = nodes.find((node) => node.fullName.toLowerCase() === category.toLowerCase());
    const leaf = nodes.find((node) => node.isLeaf && node.name.toLowerCase() === leafName.toLowerCase());
    const selected = exact ?? leaf ?? nodes[0];
    if (!selected?.id) return { warning: "Category was saved in Vendor Portal but may need manual review in Shopify." };
    await supabase.from("app_settings").upsert({ key: cacheKey, value: { categoryId: selected.id, fullName: selected.fullName, saved_at: new Date().toISOString() } });
    return { categoryId: selected.id };
  } catch {
    return { warning: "Category was saved in Vendor Portal but may need manual review in Shopify." };
  }
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

async function createShopifyProductOptions(productId: string, product: Record<string, any>) {
  const options = normaliseProductOptions(product);
  if (!options.length) return { success: false, warning: "Variant options could not be fully synced to Shopify. Please review this product in Shopify." };

  try {
    const data = await shopifyGraphQL<{
      productOptionsCreate: {
        product: { id: string } | null;
        userErrors: { field?: string[]; message: string; code?: string }[];
      };
    }>(PRODUCT_OPTIONS_CREATE, {
      productId,
      options: options.map((option) => ({
        name: option.name,
        position: option.position,
        values: option.values.map((name) => ({ name }))
      })),
      variantStrategy: "LEAVE_AS_IS"
    });
    if (data.productOptionsCreate.userErrors.length) {
      const message = formatUserErrors(data.productOptionsCreate.userErrors).toLowerCase();
      if (message.includes("already") || message.includes("exists") || message.includes("taken")) return { success: true, alreadyExists: true };
      return { success: false, warning: "Variant options could not be fully synced to Shopify. Please review this product in Shopify." };
    }
    return { success: true };
  } catch {
    return { success: false, warning: "Variant options could not be fully synced to Shopify. Please review this product in Shopify." };
  }
}

async function syncShopifyVariantsForProduct(product: Record<string, any>, shopifyProductId = product.shopify_product_gid, defaultVariantId?: string | null) {
  const warnings: string[] = [];
  if (!product.has_variants || !product.product_variants?.length || !shopifyProductId) return { warnings };

  const optionResult = await createShopifyProductOptions(shopifyProductId, product);
  if (optionResult.warning && !optionResult.alreadyExists) warnings.push(optionResult.warning);

  let shopifyVariants: ShopifyInventoryVariant[] = [];
  try {
    const data = await shopifyGraphQL<{ product: { variants: { nodes: ShopifyInventoryVariant[] } } }>(GET_PRODUCT_VARIANTS, { id: shopifyProductId });
    shopifyVariants = data.product?.variants.nodes ?? [];
  } catch {
    warnings.push("Variant options could not be fully synced to Shopify. Please review this product in Shopify.");
    return { warnings };
  }

  const localVariants = product.product_variants ?? [];
  const defaultVariant = defaultVariantId ? shopifyVariants.find((variant) => variant.id === defaultVariantId) : shopifyVariants.find((variant) => variant.title === "Default Title") ?? shopifyVariants[0];
  const createInputs: Partial<Record<string, unknown>>[] = [];
  let firstVariantGid: string | null = null;
  let firstVariantLegacyId: string | null = null;

  for (const [index, localVariant] of localVariants.entries()) {
    const matched = strictMatchShopifyVariant(localVariant, shopifyVariants);
    const target = matched ?? (index === 0 ? defaultVariant : null);
    if (target?.id) {
      const update = await updateShopifyVariantFromLocal(shopifyProductId, target.id, localVariant, product);
      if (update.warning) warnings.push(update.warning);
      firstVariantGid ??= target.id;
      firstVariantLegacyId ??= numericIdFromGid(target.id);
      continue;
    }
    createInputs.push(shopifyVariantInput(localVariant, product));
  }

  if (createInputs.length) {
    try {
      const data = await shopifyGraphQL<{
        productVariantsBulkCreate: {
          productVariants: { id: string; legacyResourceId: string; title: string }[];
          userErrors: { field?: string[]; message: string }[];
        };
      }>(PRODUCT_VARIANTS_BULK_CREATE, { productId: shopifyProductId, variants: createInputs });
      if (data.productVariantsBulkCreate.userErrors.length) warnings.push("Variant options could not be fully synced to Shopify. Please review this product in Shopify.");
      const firstCreated = data.productVariantsBulkCreate.productVariants[0];
      firstVariantGid ??= firstCreated?.id ?? null;
      firstVariantLegacyId ??= firstCreated?.legacyResourceId ?? null;
    } catch {
      warnings.push("Variant options could not be fully synced to Shopify. Please review this product in Shopify.");
    }
  }

  const inventoryResult = await syncProductInventory({ productId: product.id, shopifyProductId, product });
  warnings.push(...inventoryResult.warnings);
  return { warnings: dedupeWarnings(warnings), firstVariantGid, firstVariantLegacyId };
}

async function createShopifyVariants(productId: string, product: Record<string, any>, defaultVariantId: string) {
  const localVariants = product.product_variants ?? [];
  const [firstVariant, ...remainingVariants] = localVariants;
  if (!firstVariant) return {};

  const firstUpdate = await updateShopifyVariantFromLocal(productId, defaultVariantId, firstVariant, product);
  const warnings: string[] = [];
  if (firstUpdate.warning) warnings.push(firstUpdate.warning);

  const variants = remainingVariants.map((variant: Record<string, any>) => shopifyVariantInput(variant, product));

  if (!variants.length) return {};

  try {
    const data = await shopifyGraphQL<{
      productVariantsBulkCreate: {
        productVariants: { id: string; legacyResourceId: string; title: string }[];
        userErrors: { field?: string[]; message: string }[];
      };
    }>(PRODUCT_VARIANTS_BULK_CREATE, { productId, variants });
    if (data.productVariantsBulkCreate.userErrors.length) {
      warnings.push("Variant options could not be fully synced to Shopify. Please review this product in Shopify.");
    }
    const firstVariant = data.productVariantsBulkCreate.productVariants[0];
    return {
      warning: warnings.length ? warnings.join(" ") : undefined,
      firstVariantGid: firstVariant?.id ?? defaultVariantId,
      firstVariantLegacyId: firstVariant?.legacyResourceId ?? numericIdFromGid(defaultVariantId)
    };
  } catch (error) {
    return { warning: "Variant options could not be fully synced to Shopify. Please review this product in Shopify." };
  }
}

async function updateShopifyVariantFromLocal(productId: string, variantId: string, localVariant: Record<string, any>, product: Record<string, any>) {
  try {
    const data = await shopifyGraphQL<{
      productVariantsBulkUpdate: { userErrors: { field?: string[]; message: string }[] };
    }>(PRODUCT_VARIANTS_BULK_UPDATE, {
      productId,
      variants: [cleanObject({ id: variantId, ...shopifyVariantInput(localVariant, product) })]
    });
    if (data.productVariantsBulkUpdate.userErrors.length) {
      return { warning: "Variant options could not be fully synced to Shopify. Please review this product in Shopify." };
    }
    return {};
  } catch {
    return { warning: "Variant options could not be fully synced to Shopify. Please review this product in Shopify." };
  }
}

function shopifyVariantInput(variant: Record<string, any>, product: Record<string, any>) {
  const sku = variant.sku || generatedSku(product, variant);
  return cleanObject({
    optionValues: variantOptionValues(variant),
    price: money(variant.price),
    compareAtPrice: variant.compare_at_price ? money(variant.compare_at_price) : undefined,
    barcode: variant.barcode || undefined,
    inventoryItem: sku ? { sku } : undefined
  });
}

const GET_PRODUCT_VARIANTS = `
query GetProductVariants($id: ID!) {
  product(id: $id) {
    id
    variants(first: 100) {
      nodes {
        id
        title
        sku
        selectedOptions {
          name
          value
        }
        inventoryItem {
          id
          tracked
        }
      }
    }
  }
}`;

const LOCATIONS_QUERY = `
query {
  locations(first: 10, sortKey: NAME) {
    nodes {
      id
      name
      isActive
      fulfillsOnlineOrders
    }
  }
}`;

const INVENTORY_ITEM_UPDATE = `
mutation InventoryItemUpdate($id: ID!, $input: InventoryItemInput!) {
  inventoryItemUpdate(id: $id, input: $input) {
    inventoryItem {
      id
      tracked
    }
    userErrors {
      field
      message
    }
  }
}`;

const INVENTORY_ACTIVATE = `
mutation InventoryActivate($inventoryItemId: ID!, $locationId: ID!) {
  inventoryActivate(inventoryItemId: $inventoryItemId, locationId: $locationId) {
    inventoryLevel {
      id
    }
    userErrors {
      field
      message
    }
  }
}`;

const INVENTORY_SET_QUANTITIES = `
mutation InventorySetQuantities($input: InventorySetQuantitiesInput!) {
  inventorySetQuantities(input: $input) {
    inventoryAdjustmentGroup {
      createdAt
      reason
      referenceDocumentUri
      changes {
        name
        delta
        quantityAfterChange
      }
    }
    userErrors {
      field
      message
    }
  }
}`;

export async function getDefaultShopifyLocationId(forceRefresh = false) {
  const supabase = createAdminClient();
  if (!forceRefresh) {
    const { data } = await supabase.from("app_settings").select("value").eq("key", "shopify_default_location_id").maybeSingle();
    const value = data?.value as { locationId?: string; name?: string } | null;
    if (value?.locationId) return { locationId: value.locationId, name: value.name };
  }

  const data = await shopifyGraphQL<{ locations: { nodes: { id: string; name: string; isActive: boolean; fulfillsOnlineOrders: boolean }[] } }>(LOCATIONS_QUERY);
  const locations = data.locations.nodes;
  const selected = locations.find((location) => location.isActive && location.fulfillsOnlineOrders) ?? locations.find((location) => location.isActive);
  if (!selected) throw new Error("No active Shopify location found.");
  const value = { locationId: selected.id, name: selected.name, saved_at: new Date().toISOString() };
  await supabase.from("app_settings").upsert({ key: "shopify_default_location_id", value });
  return value;
}

async function enableInventoryTracking(inventoryItemId: string) {
  const data = await shopifyGraphQL<{ inventoryItemUpdate: { userErrors: { field?: string[]; message: string }[] } }>(INVENTORY_ITEM_UPDATE, {
    id: inventoryItemId,
    input: { tracked: true }
  });
  if (data.inventoryItemUpdate.userErrors.length) throw new Error(formatUserErrors(data.inventoryItemUpdate.userErrors));
}

async function activateInventoryItemAtLocation(inventoryItemId: string, locationId: string) {
  const data = await shopifyGraphQL<{ inventoryActivate: { userErrors: { field?: string[]; message: string }[] } }>(INVENTORY_ACTIVATE, { inventoryItemId, locationId });
  const errors = data.inventoryActivate.userErrors;
  if (errors.length && !formatUserErrors(errors).toLowerCase().includes("already")) throw new Error(formatUserErrors(errors));
}

async function setInventoryQuantity(inventoryItemId: string, locationId: string, quantity: number, productId: string) {
  const data = await shopifyGraphQL<{ inventorySetQuantities: { userErrors: { field?: string[]; message: string }[] } }>(INVENTORY_SET_QUANTITIES, {
    input: {
      name: "available",
      reason: "correction",
      referenceDocumentUri: `vendor-portal://product/${productId}`,
      quantities: [
        {
          inventoryItemId,
          locationId,
          quantity: Math.max(0, Math.floor(Number(quantity || 0))),
          changeFromQuantity: null
        }
      ]
    }
  });
  if (data.inventorySetQuantities.userErrors.length) throw new Error(formatUserErrors(data.inventorySetQuantities.userErrors));
}

async function syncProductInventory({ productId, shopifyProductId, defaultVariant, product }: { productId: string; shopifyProductId: string; defaultVariant?: any; product: Record<string, any> }) {
  const supabase = createAdminClient();
  const warnings: string[] = [];
  let defaultInventoryItemId = defaultVariant?.inventoryItem?.id ?? null;
  let location: { locationId: string; name?: string };
  try {
    location = await getDefaultShopifyLocationId();
  } catch (error) {
    return { warnings: [inventoryPermissionWarning(error)], defaultInventoryItemId };
  }

  let shopifyVariants: ShopifyInventoryVariant[] = [];
  try {
    const data = await shopifyGraphQL<{ product: { variants: { nodes: typeof shopifyVariants } } }>(GET_PRODUCT_VARIANTS, { id: shopifyProductId });
    shopifyVariants = data.product?.variants.nodes ?? [];
  } catch (error) {
    return { warnings: ["Inventory sync skipped because Shopify variants could not be read after creation."], defaultInventoryItemId };
  }

  const localVariants = product.has_variants && product.product_variants?.length ? product.product_variants : [{ id: "default", sku: product.sku, stock: product.stock, title: "Default Title" }];
  const failures: string[] = [];

  for (const localVariant of localVariants) {
    const matched = matchShopifyVariant(localVariant, shopifyVariants);
    const inventoryItemId = matched?.inventoryItem?.id;
    const sku = localVariant.sku || matched?.sku || matched?.title || "default variant";
    if (!inventoryItemId) {
      failures.push(`Inventory for SKU ${sku} could not be synced.`);
      continue;
    }
    try {
      if (!matched?.inventoryItem?.tracked) await enableInventoryTracking(inventoryItemId);
      await activateInventoryItemAtLocation(inventoryItemId, location.locationId);
      await setInventoryQuantity(inventoryItemId, location.locationId, Number(localVariant.stock ?? 0), productId);
      if (localVariant.id === "default") defaultInventoryItemId = inventoryItemId;
      else {
        await supabase
          .from("product_variants")
          .update({
            shopify_variant_gid: matched?.id ?? null,
            shopify_variant_id: numericIdFromGid(matched?.id),
            shopify_inventory_item_gid: inventoryItemId
          })
          .eq("id", localVariant.id);
      }
    } catch (error) {
      failures.push(`Inventory for SKU ${sku} could not be synced.`);
    }
  }

  if (failures.length) warnings.push(failures.join(" "));
  return { warnings, defaultInventoryItemId };
}

function matchShopifyVariant(localVariant: Record<string, any>, shopifyVariants: { id: string; title: string; sku?: string | null; selectedOptions?: { name: string; value: string }[]; inventoryItem?: { id: string; tracked: boolean } | null }[]) {
  if (localVariant.sku) {
    const bySku = shopifyVariants.find((variant) => variant.sku && variant.sku === localVariant.sku);
    if (bySku) return bySku;
  }
  const bySelectedOptions = shopifyVariants.find((variant) => selectedOptionsMatch(localVariant, variant.selectedOptions ?? []));
  if (bySelectedOptions) return bySelectedOptions;
  const title = [localVariant.option1_value, localVariant.option2_value, localVariant.option3_value].filter(Boolean).join(" / ") || "Default Title";
  return shopifyVariants.find((variant) => variant.title === title) ?? shopifyVariants[0];
}

function selectedOptionsMatch(localVariant: Record<string, any>, selectedOptions: { name: string; value: string }[]) {
  const local = variantOptionValues(localVariant);
  return local.length > 0 && local.every((option) => selectedOptions.some((selected) => selected.name === option.optionName && selected.value === option.name));
}

function validateLocalVariants(product: Record<string, any>) {
  const variants = product.product_variants ?? [];
  if (!variants.length) throw new Error("At least one variant is required.");
  const missingPrice = variants.find((variant: Record<string, any>) => variant.price === null || variant.price === undefined || Number(variant.price) <= 0);
  if (missingPrice) throw new Error("Variant price is required.");
}

function normaliseProductOptions(product: Record<string, any>) {
  const rawOptions = Array.isArray(product.options) ? product.options : [];
  return rawOptions
    .slice(0, 3)
    .map((option: Record<string, any>, index: number) => ({
      name: String(option.name ?? `Option ${index + 1}`).trim(),
      position: index + 1,
      values: uniqueStrings(Array.isArray(option.values) ? option.values : [])
    }))
    .filter((option) => option.name && option.values.length);
}

function variantOptionValues(variant: Record<string, any>) {
  return [
    variant.option1_value ? { optionName: variant.option1_name || "Title", name: String(variant.option1_value).trim() } : null,
    variant.option2_value ? { optionName: variant.option2_name || "Option 2", name: String(variant.option2_value).trim() } : null,
    variant.option3_value ? { optionName: variant.option3_name || "Option 3", name: String(variant.option3_value).trim() } : null
  ].filter((value): value is { optionName: string; name: string } => Boolean(value));
}

function generatedSku(product: Record<string, any>, variant: Record<string, any>) {
  const base = String(product.sku || product.title || "variant").trim();
  const suffix = [variant.option1_value, variant.option2_value, variant.option3_value].filter(Boolean).map(slugify).join("-");
  return suffix ? `${slugify(base)}-${suffix}`.toUpperCase() : slugify(base).toUpperCase();
}

function slugify(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueStrings(values: unknown[]) {
  const seen = new Set<string>();
  return values.map((value) => String(value).trim()).filter((value) => {
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function inventoryPermissionWarning(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.toLowerCase().includes("access denied") || message.toLowerCase().includes("locations")) {
    return "Inventory sync skipped because the Shopify app is missing inventory/location permissions.";
  }
  return `Inventory sync skipped: ${message || "No active Shopify location found."}`;
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
    .select("*, vendors(*), product_variants(*)")
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
  const warnings: string[] = [];
  const categoryResult = await resolveShopifyCategoryId(product.category, product.shopify_category_id);
  if (categoryResult.warning) warnings.push(categoryResult.warning);

  let data: {
    productUpdate: {
      product: { id: string; legacyResourceId: string; status: string } | null;
      userErrors: { field?: string[]; message: string }[];
    };
  };

  const updateInput = cleanObject({
    id: product.shopify_product_gid,
    title: product.title,
    descriptionHtml,
    vendor: vendorName,
    productType: product.product_type || undefined,
    category: categoryResult.categoryId || undefined,
    tags,
    seo: {
      title: product.seo_title || product.title,
      description: product.seo_description || undefined
    }
  });

  try {
    data = await updateProductWithCategoryFallback(updateInput, warnings);
  } catch (error) {
    throw new ShopifyDraftCreationError("Shopify product update failed.", error instanceof Error ? error.message : error);
  }

  if (data.productUpdate.userErrors.length) {
    throw new ShopifyDraftCreationError("Shopify product update failed.", data.productUpdate.userErrors);
  }

  if (product.has_variants) {
    const variantResult = await syncShopifyVariantsForProduct(product);
    warnings.push(...variantResult.warnings);
  } else {
    const defaultVariant = await getDefaultShopifyVariant(product.shopify_product_gid);
    if (defaultVariant?.id) {
      const variantUpdate = await updateDefaultVariant(defaultVariant.id, product.shopify_product_gid, product);
      if (variantUpdate.warning) warnings.push(variantUpdate.warning);
    } else {
      warnings.push("Default variant price could not be synced because Shopify did not return a default variant.");
    }
    const inventoryResult = await syncProductInventory({ productId: product.id, shopifyProductId: product.shopify_product_gid, product });
    warnings.push(...inventoryResult.warnings);
  }

  return { updated: true, warning: dedupeWarnings(warnings).join(" ") || undefined, warnings: dedupeWarnings(warnings) };
}

async function getDefaultShopifyVariant(shopifyProductId: string) {
  try {
    const data = await shopifyGraphQL<{ product: { variants: { nodes: ShopifyInventoryVariant[] } } }>(GET_PRODUCT_VARIANTS, { id: shopifyProductId });
    return data.product?.variants.nodes.find((variant) => variant.title === "Default Title") ?? data.product?.variants.nodes[0] ?? null;
  } catch {
    return null;
  }
}

async function updateProductWithCategoryFallback(input: Record<string, unknown>, warnings: string[]) {
  try {
    const data = await shopifyGraphQL<{
      productUpdate: {
        product: { id: string; legacyResourceId: string; status: string } | null;
        userErrors: { field?: string[]; message: string }[];
      };
    }>(PRODUCT_UPDATE, { input });
    if ("category" in input && hasCategoryUserError(data.productUpdate.userErrors)) {
      warnings.push("Category was saved in Vendor Portal but may need manual review in Shopify.");
      const { category: _category, ...fallbackInput } = input;
      return shopifyGraphQL<{
        productUpdate: {
          product: { id: string; legacyResourceId: string; status: string } | null;
          userErrors: { field?: string[]; message: string }[];
        };
      }>(PRODUCT_UPDATE, { input: fallbackInput });
    }
    return data;
  } catch (error) {
    if ("category" in input && isCategoryInputError(error)) {
      warnings.push("Category was saved in Vendor Portal but may need manual review in Shopify.");
      const { category: _category, ...fallbackInput } = input;
      return shopifyGraphQL<{
        productUpdate: {
          product: { id: string; legacyResourceId: string; status: string } | null;
          userErrors: { field?: string[]; message: string }[];
        };
      }>(PRODUCT_UPDATE, { input: fallbackInput });
    }
    throw error;
  }
}

function strictMatchShopifyVariant(localVariant: Record<string, any>, shopifyVariants: ShopifyInventoryVariant[]) {
  if (localVariant.sku) {
    const bySku = shopifyVariants.find((variant) => variant.sku && variant.sku === localVariant.sku);
    if (bySku) return bySku;
  }
  const bySelectedOptions = shopifyVariants.find((variant) => selectedOptionsMatch(localVariant, variant.selectedOptions ?? []));
  if (bySelectedOptions) return bySelectedOptions;
  const title = [localVariant.option1_value, localVariant.option2_value, localVariant.option3_value].filter(Boolean).join(" / ");
  return title ? shopifyVariants.find((variant) => variant.title === title) : undefined;
}

function dedupeWarnings(warnings: string[]) {
  return Array.from(new Set(warnings.filter(Boolean)));
}

function isCategoryInputError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.toLowerCase().includes("category");
}

function hasCategoryUserError(errors: { field?: string[]; message: string }[]) {
  return errors.some((error) => error.field?.some((field) => String(field).toLowerCase().includes("category")) || error.message.toLowerCase().includes("category"));
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
      if (isShopifyProductNotFound(data.productUpdate.userErrors)) return { archived: true, notFound: true, warning: "Shopify product not found but still deleted locally." };
      throw new ShopifyDraftCreationError("Shopify product archive failed.", data.productUpdate.userErrors);
    }
    return { archived: true };
  } catch (error) {
    if (error instanceof ShopifyDraftCreationError) throw error;
    if (isShopifyProductNotFound(error)) return { archived: true, notFound: true, warning: "Shopify product not found but still deleted locally." };
    throw new ShopifyDraftCreationError("Shopify product archive failed.", error instanceof Error ? error.message : error);
  }
}

function isShopifyProductNotFound(error: unknown) {
  const text = Array.isArray(error)
    ? error.map((item) => `${item?.field?.join?.(".") ?? ""} ${item?.message ?? ""}`).join(" ")
    : error instanceof Error
      ? error.message
      : JSON.stringify(error ?? "");
  const lower = text.toLowerCase();
  return lower.includes("not found") || lower.includes("does not exist") || lower.includes("invalid id") || lower.includes("could not find");
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

import { NextResponse } from "next/server";
import { requireVendorApi } from "@/lib/permissions";

type PriceUpdateItem = {
  productId: string;
  price: number;
};

const PRODUCT_FIELDS = [
  "title",
  "description",
  "description_data",
  "final_description",
  "product_type",
  "category",
  "category_id",
  "shopify_category_id",
  "tags",
  "price",
  "compare_at_price",
  "cost_price",
  "sku",
  "barcode",
  "stock",
  "seo_title",
  "seo_description",
  "google_product_category",
  "has_variants",
  "options"
];

export async function POST(request: Request) {
  const ctx = await requireVendorApi();
  if ("error" in ctx) return ctx.error;

  const body = await request.json().catch(() => ({}));
  const items = Array.isArray(body.items) ? parseItems(body.items) : [];
  if (!items.length) return NextResponse.json({ error: "At least one product price is required." }, { status: 400 });

  const productIds = items.map((item) => item.productId);
  const priceByProductId = new Map(items.map((item) => [item.productId, item.price]));

  const { data: products, error: productError } = await ctx.supabase
    .from("vendor_products")
    .select("*, product_images(*), product_variants(*)")
    .eq("vendor_id", ctx.vendor.id)
    .in("id", productIds);

  if (productError) return NextResponse.json({ error: productError.message }, { status: 400 });

  const { data: existingRequests, error: existingError } = await ctx.supabase
    .from("product_change_requests")
    .select("product_id")
    .eq("vendor_id", ctx.vendor.id)
    .eq("request_type", "edit")
    .eq("status", "pending")
    .in("product_id", productIds);

  if (existingError) {
    return NextResponse.json({ error: "Price update requests could not be submitted. Please contact admin.", details: existingError.message }, { status: 500 });
  }

  const existingRequestRows = (existingRequests ?? []) as { product_id: string }[];
  const productRows = (products ?? []) as Record<string, any>[];
  const existingProductIds = new Set(existingRequestRows.map((request) => request.product_id));
  const foundProductIds = new Set(productRows.map((product) => product.id));
  const requests = [];
  const failedItems: { productId: string; title?: string; error: string }[] = [];

  for (const item of items) {
    const product = productRows.find((row) => row.id === item.productId);
    if (!product || !foundProductIds.has(item.productId)) {
      failedItems.push({ productId: item.productId, error: "Product not found." });
      continue;
    }
    if (!["approved", "shopify_draft"].includes(product.status)) {
      failedItems.push({ productId: item.productId, title: product.title, error: "Only approved or live products can request price updates." });
      continue;
    }
    if (existingProductIds.has(item.productId)) {
      failedItems.push({ productId: item.productId, title: product.title, error: "A pending update request already exists." });
      continue;
    }

    const proposedData = buildPriceUpdateProposedData(product, priceByProductId.get(item.productId) ?? item.price);
    requests.push({
      product_id: item.productId,
      vendor_id: ctx.vendor.id,
      request_type: "edit",
      proposed_data: proposedData,
      reason: null
    });
  }

  if (!requests.length) {
    return NextResponse.json({ successCount: 0, failedCount: failedItems.length, failedItems }, { status: 400 });
  }

  const { data: inserted, error: insertError } = await ctx.supabase
    .from("product_change_requests")
    .insert(requests)
    .select("id, product_id");

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });

  if (inserted?.length) {
    await ctx.supabase.from("activity_logs").insert(
      ((inserted ?? []) as { id: string; product_id: string }[]).map((row) => ({
        user_id: ctx.profile.id,
        vendor_id: ctx.vendor.id,
        action: "bulk_price_update_requested",
        entity_type: "product_change_requests",
        entity_id: row.id,
        metadata: { product_id: row.product_id }
      }))
    );
  }

  return NextResponse.json({
    successCount: inserted?.length ?? 0,
    failedCount: failedItems.length,
    failedItems,
    message: `${inserted?.length ?? 0} price update requests submitted.`
  });
}

function parseItems(items: unknown[]): PriceUpdateItem[] {
  const seen = new Set<string>();
  return items.flatMap((item) => {
    const input = item as { productId?: unknown; price?: unknown };
    const productId = typeof input.productId === "string" ? input.productId : "";
    const price = Number(input.price);
    if (!productId || seen.has(productId) || !Number.isFinite(price) || price <= 0) return [];
    seen.add(productId);
    return [{ productId, price }];
  });
}

function buildPriceUpdateProposedData(product: Record<string, any>, price: number) {
  const proposed = Object.fromEntries(PRODUCT_FIELDS.filter((field) => field in product).map((field) => [field, product[field]]));
  proposed.product_images = product.product_images ?? [];
  if (product.has_variants) {
    proposed.price = null;
    proposed.compare_at_price = null;
    proposed.variants = (product.product_variants ?? []).map((variant: Record<string, any>) => ({
      ...variant,
      price
    }));
  } else {
    proposed.price = price;
  }
  return proposed;
}

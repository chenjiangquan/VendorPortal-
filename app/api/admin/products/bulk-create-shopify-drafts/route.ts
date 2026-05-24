import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/permissions";
import { createShopifyDraftProduct, ShopifyDraftCreationError } from "@/lib/shopify";

type BulkProduct = {
  id: string;
  title: string;
  status: string;
  shopify_product_gid?: string | null;
};

export async function POST(request: Request) {
  const ctx = await requireAdminApi();
  if ("error" in ctx) return ctx.error;

  const body = await request.json().catch(() => ({}));
  const productIds = Array.isArray(body.productIds) ? body.productIds.filter((id: unknown): id is string => typeof id === "string") : [];
  if (!productIds.length) return NextResponse.json({ error: "Select at least one submitted product." }, { status: 400 });

  const { data: products, error } = await ctx.supabase
    .from("vendor_products")
    .select("id,title,status,shopify_product_gid")
    .in("id", productIds);

  if (error) return NextResponse.json({ error: "Could not load selected products.", details: error.message }, { status: 400 });

  const rows = (products ?? []) as BulkProduct[];
  const eligibleProducts = rows.filter((product: BulkProduct) => product.status === "submitted" && !product.shopify_product_gid);
  const skippedProducts = rows.filter((product: BulkProduct) => product.status !== "submitted" || product.shopify_product_gid);
  const failedItems: { productId: string; title: string; error: string; details?: unknown }[] = skippedProducts.map((product: BulkProduct) => ({
    productId: product.id,
    title: product.title,
    error: "Only submitted products without an existing Shopify draft can be processed."
  }));

  let successCount = 0;

  for (const product of eligibleProducts) {
    try {
      await createShopifyDraftProduct(product.id);
      successCount += 1;
    } catch (error) {
      failedItems.push({
        productId: product.id,
        title: product.title,
        error: "Shopify draft creation failed.",
        details: error instanceof ShopifyDraftCreationError ? error.details : error instanceof Error ? error.message : error
      });
    }
  }

  return NextResponse.json({
    successCount,
    failedCount: failedItems.length,
    failedItems
  });
}

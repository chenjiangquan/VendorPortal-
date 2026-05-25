import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/permissions";
import { createShopifyDraftProduct, ShopifyDraftCreationError } from "@/lib/shopify";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdminApi();
  if ("error" in ctx) return ctx.error;
  const { id } = await params;
  try {
    const result = await createShopifyDraftProduct(id);
    const warnings = "warnings" in result && Array.isArray(result.warnings) ? result.warnings : [];
    return NextResponse.json({
      ...result,
      message: result.alreadyExists
        ? "Shopify draft already exists."
        : warnings.length
          ? "Shopify Draft created with warnings. Please review the Shopify product."
          : "Shopify Draft created successfully."
    });
  } catch (error) {
    const details = error instanceof ShopifyDraftCreationError ? error.details : error instanceof Error ? error.message : error;
    return NextResponse.json({ error: "Shopify draft creation failed.", details }, { status: 400 });
  }
}

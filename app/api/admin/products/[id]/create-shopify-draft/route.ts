import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/permissions";
import { createShopifyDraftProduct } from "@/lib/shopify";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdminApi();
  if ("error" in ctx) return ctx.error;
  const { id } = await params;
  try {
    const result = await createShopifyDraftProduct(id);
    return NextResponse.json({ ...result, message: result.alreadyExists ? "Shopify draft already exists." : "Shopify draft created." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Shopify creation failed." }, { status: 400 });
  }
}

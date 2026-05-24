import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/permissions";
import { approveDeleteRequest, approveEditRequest } from "@/lib/product-request-actions";
import { ShopifyDraftCreationError } from "@/lib/shopify";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdminApi();
  if ("error" in ctx) return ctx.error;
  const { id } = await params;

  const { data: request } = await ctx.supabase.from("product_change_requests").select("request_type").eq("id", id).single();
  if (!request) return NextResponse.json({ error: "Request not found." }, { status: 404 });

  try {
    const result = request.request_type === "edit" ? await approveEditRequest(ctx, id) : await approveDeleteRequest(ctx, id);
    return NextResponse.json({
      ...result,
      message: request.request_type === "edit" ? "Product update approved and Shopify draft updated." : "Delete request approved. Product archived."
    });
  } catch (error) {
    return NextResponse.json({
      error: request.request_type === "edit" ? "Product update approval failed." : "Delete request approval failed.",
      details: error instanceof ShopifyDraftCreationError ? error.details : error instanceof Error ? error.message : error
    }, { status: 400 });
  }
}

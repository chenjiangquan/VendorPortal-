import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/permissions";

export async function GET() {
  const ctx = await requireAdminApi();
  if ("error" in ctx) return ctx.error;

  const { count: newProducts } = await ctx.supabase
    .from("vendor_products")
    .select("id", { count: "exact", head: true })
    .eq("status", "submitted")
    .is("shopify_product_gid", null);

  const { count: editRequests, error: editError } = await ctx.supabase
    .from("product_change_requests")
    .select("id", { count: "exact", head: true })
    .eq("request_type", "edit")
    .eq("status", "pending");

  const { count: deleteRequests, error: deleteError } = await ctx.supabase
    .from("product_change_requests")
    .select("id", { count: "exact", head: true })
    .eq("request_type", "delete")
    .eq("status", "pending");

  return NextResponse.json({
    newProducts: newProducts ?? 0,
    editRequests: editError ? 0 : editRequests ?? 0,
    deleteRequests: deleteError ? 0 : deleteRequests ?? 0
  });
}

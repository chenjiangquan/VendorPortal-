import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/permissions";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdminApi();
  if ("error" in ctx) return ctx.error;
  const { id } = await params;
  const { data, error } = await ctx.supabase.from("vendor_products").update({ status: "approved", approved_at: new Date().toISOString() }).eq("id", id).eq("status", "submitted").select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await ctx.supabase.from("activity_logs").insert({ user_id: ctx.profile.id, vendor_id: data.vendor_id, action: "product_approved", entity_type: "vendor_products", entity_id: id });
  return NextResponse.json({ product: data, message: "Product approved." });
}

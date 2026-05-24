import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/permissions";
import { productRejectSchema } from "@/lib/validators";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdminApi();
  if ("error" in ctx) return ctx.error;
  const parsed = productRejectSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const { id } = await params;
  const { data, error } = await ctx.supabase.from("vendor_products").update({ status: "rejected", rejected_at: new Date().toISOString(), rejection_reason: parsed.data.rejection_reason }).eq("id", id).eq("status", "submitted").select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await ctx.supabase.from("activity_logs").insert({ user_id: ctx.profile.id, vendor_id: data.vendor_id, action: "product_rejected", entity_type: "vendor_products", entity_id: id });
  return NextResponse.json({ product: data, message: "Product rejected." });
}

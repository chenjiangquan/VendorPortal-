import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/permissions";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdminApi();
  if ("error" in ctx) return ctx.error;
  const { id } = await params;
  const { data: tracking, error } = await ctx.supabase
    .from("tracking_submissions")
    .update({ status: "reviewed", reviewed_at: new Date().toISOString(), reviewed_by: ctx.profile.id })
    .eq("id", id)
    .eq("status", "submitted")
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await ctx.supabase.from("vendor_orders").update({ status: "reviewed" }).eq("id", tracking.vendor_order_id);
  await ctx.supabase.from("activity_logs").insert({ user_id: ctx.profile.id, vendor_id: tracking.vendor_id, action: "tracking_reviewed", entity_type: "tracking_submissions", entity_id: id });
  return NextResponse.json({ tracking, message: "Tracking marked reviewed." });
}

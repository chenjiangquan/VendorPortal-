import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/permissions";
import { trackingRejectSchema } from "@/lib/validators";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdminApi();
  if ("error" in ctx) return ctx.error;
  const parsed = trackingRejectSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const { id } = await params;
  const { data: tracking, error } = await ctx.supabase
    .from("tracking_submissions")
    .update({ status: "rejected", admin_note: parsed.data.admin_note, reviewed_at: new Date().toISOString(), reviewed_by: ctx.profile.id })
    .eq("id", id)
    .eq("status", "submitted")
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await ctx.supabase.from("vendor_orders").update({ status: "open" }).eq("id", tracking.vendor_order_id);
  await ctx.supabase.from("activity_logs").insert({ user_id: ctx.profile.id, vendor_id: tracking.vendor_id, action: "tracking_rejected", entity_type: "tracking_submissions", entity_id: id });
  return NextResponse.json({ tracking, message: "Tracking rejected." });
}

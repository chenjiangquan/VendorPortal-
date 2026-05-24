import { NextResponse } from "next/server";
import { requireVendorApi } from "@/lib/permissions";
import { trackingSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const ctx = await requireVendorApi();
  if ("error" in ctx) return ctx.error;
  const parsed = trackingSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const { vendor_order_id, ...tracking } = parsed.data;

  const { data: order } = await ctx.supabase.from("vendor_orders").select("*").eq("id", vendor_order_id).eq("vendor_id", ctx.vendor.id).single();
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (!["open", "tracking_submitted"].includes(order.status)) return NextResponse.json({ error: "Tracking cannot be submitted for this order." }, { status: 400 });

  const { data, error } = await ctx.supabase
    .from("tracking_submissions")
    .insert({ ...tracking, vendor_order_id, vendor_id: ctx.vendor.id, status: "submitted" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await ctx.supabase.from("vendor_orders").update({ status: "tracking_submitted" }).eq("id", vendor_order_id);
  await ctx.supabase.from("activity_logs").insert({ user_id: ctx.profile.id, vendor_id: ctx.vendor.id, action: "tracking_submitted", entity_type: "tracking_submissions", entity_id: data.id });
  return NextResponse.json({ tracking: data });
}

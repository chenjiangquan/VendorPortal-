import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const updateVendorSchema = z.object({
  company_name: z.string().trim().min(1).max(160).optional(),
  contact_name: z.string().trim().max(120).optional().nullable(),
  email: z.string().trim().email().max(160).optional(),
  phone: z.string().trim().max(80).optional().nullable(),
  website: z.string().trim().max(200).optional().nullable(),
  country: z.string().trim().max(100).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
  postcode: z.string().trim().max(40).optional().nullable(),
  business_type: z.string().trim().max(100).optional().nullable(),
  shopify_vendor_name: z.string().trim().max(120).optional().nullable(),
  commission_rate: z.coerce.number().min(0).max(100).optional(),
  status: z.enum(["active", "suspended", "archived"]).optional(),
  notes: z.string().trim().max(2000).optional().nullable()
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdminApi();
  if ("error" in ctx) return ctx.error;

  const parsed = updateVendorSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid vendor update." }, { status: 400 });
  }

  const { id } = await params;
  const admin = createAdminClient();
  const updates = Object.fromEntries(
    Object.entries(parsed.data).map(([key, value]) => [key, value === "" ? null : value])
  ) as Record<string, unknown>;
  updates.updated_at = new Date().toISOString();

  const { data: vendor, error } = await admin
    .from("vendors")
    .update(updates)
    .eq("id", id)
    .select("id,company_name,contact_name,email,shopify_vendor_name,status")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await admin.from("activity_logs").insert({
    user_id: ctx.profile.id,
    vendor_id: id,
    action: "vendor_updated",
    entity_type: "vendors",
    entity_id: id,
    metadata: { fields: Object.keys(parsed.data), company_name: vendor.company_name }
  });

  return NextResponse.json({ vendor });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdminApi();
  if ("error" in ctx) return ctx.error;

  const { id } = await params;
  const admin = createAdminClient();

  const { data: vendor, error: vendorError } = await admin
    .from("vendors")
    .select("id,user_id,company_name,email")
    .eq("id", id)
    .single();

  if (vendorError || !vendor) {
    return NextResponse.json({ error: vendorError?.message ?? "Vendor not found." }, { status: 404 });
  }

  const { error: vendorLogError } = await admin.from("activity_logs").delete().eq("vendor_id", vendor.id);
  if (vendorLogError) return NextResponse.json({ error: vendorLogError.message }, { status: 400 });

  if (vendor.user_id) {
    const { error: userLogError } = await admin.from("activity_logs").delete().eq("user_id", vendor.user_id);
    if (userLogError) return NextResponse.json({ error: userLogError.message }, { status: 400 });
  }

  if (vendor.user_id) {
    const { error: authError } = await admin.auth.admin.deleteUser(vendor.user_id);
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }
  } else {
    const { error: deleteError } = await admin.from("vendors").delete().eq("id", vendor.id);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  await admin.from("activity_logs").insert({
    user_id: ctx.profile.id,
    action: "vendor_deleted",
    entity_type: "vendors",
    entity_id: vendor.id,
    metadata: { company_name: vendor.company_name, email: vendor.email }
  });

  return NextResponse.json({ success: true });
}

import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

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

  await admin.from("activity_logs").delete().or(`vendor_id.eq.${vendor.id},user_id.eq.${vendor.user_id}`);

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

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/permissions";
import { vendorCreateSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const ctx = await requireAdminApi();
  if ("error" in ctx) return ctx.error;

  const parsed = vendorCreateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const admin = createAdminClient();
  const input = parsed.data;
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.temporary_password,
    email_confirm: true,
    user_metadata: { full_name: input.contact_name }
  });
  if (authError || !created.user) return NextResponse.json({ error: authError?.message ?? "Could not create user" }, { status: 400 });

  const profile = { id: created.user.id, role: "vendor", full_name: input.contact_name, email: input.email };
  const { error: profileError } = await admin.from("profiles").insert(profile);
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 });

  const { data: vendor, error: vendorError } = await admin
    .from("vendors")
    .insert({
      user_id: created.user.id,
      company_name: input.company_name,
      contact_name: input.contact_name,
      email: input.email,
      phone: input.phone,
      country: input.country,
      city: input.city,
      shopify_vendor_name: input.shopify_vendor_name,
      commission_rate: input.commission_rate,
      notes: input.notes,
      created_by: ctx.profile.id
    })
    .select()
    .single();
  if (vendorError) return NextResponse.json({ error: vendorError.message }, { status: 400 });

  await admin.from("activity_logs").insert({
    user_id: ctx.profile.id,
    vendor_id: vendor.id,
    action: "vendor_created",
    entity_type: "vendors",
    entity_id: vendor.id
  });

  return NextResponse.json({
    vendor,
    loginDetails: {
      loginUrl: `${process.env.APP_URL ?? "http://localhost:3000"}/login`,
      email: input.email,
      password: input.temporary_password
    }
  });
}

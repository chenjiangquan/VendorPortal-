import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function apiProfile() {
  const supabase = await createClient();
  const { data: userData, error } = await supabase.auth.getUser();
  if (error || !userData.user) {
    return { error: NextResponse.json({ error: "Unauthenticated" }, { status: 401 }) };
  }
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userData.user.id).single();
  if (!profile) return { error: NextResponse.json({ error: "Profile not found" }, { status: 403 }) };
  return { supabase, user: userData.user, profile };
}

export async function requireAdminApi(): Promise<any> {
  const ctx = await apiProfile();
  if ("error" in ctx) return ctx;
  if (ctx.profile.role !== "admin") {
    return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) };
  }
  return ctx;
}

export async function requireVendorApi(): Promise<any> {
  const ctx = await apiProfile();
  if ("error" in ctx) return ctx;
  if (ctx.profile.role !== "vendor") {
    return { error: NextResponse.json({ error: "Vendor access required" }, { status: 403 }) };
  }
  const { data: vendor } = await ctx.supabase.from("vendors").select("*").eq("user_id", ctx.profile.id).single();
  if (!vendor || vendor.status !== "active") {
    return { error: NextResponse.json({ error: "Vendor account is not active" }, { status: 403 }) };
  }
  return { ...ctx, vendor };
}

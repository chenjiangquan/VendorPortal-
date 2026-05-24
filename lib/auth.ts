import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "admin" | "vendor";

export async function getSessionUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

export async function getProfile() {
  const user = await getSessionUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return data as { id: string; role: Role; full_name: string | null; email: string | null } | null;
}

export async function requireProfile() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return profile;
}

export async function requireRole(role: Role) {
  const profile = await requireProfile();
  if (profile.role !== role && profile.role !== "admin") {
    redirect(profile.role === "vendor" ? "/vendor" : "/login");
  }
  return profile;
}

export async function requireVendor() {
  const profile = await requireProfile();
  if (profile.role !== "vendor") redirect("/admin");
  const supabase = await createClient();
  const { data } = await supabase.from("vendors").select("*").eq("user_id", profile.id).single();
  if (!data || data.status !== "active") redirect("/login?suspended=1");
  return { profile, vendor: data };
}

export async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

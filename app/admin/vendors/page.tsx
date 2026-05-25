import Link from "next/link";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { AdminVendorsTable } from "@/components/admin/AdminVendorsTable";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminVendorsPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const { data } = await supabase.from("vendors").select("*").order("created_at", { ascending: false });
  const vendors = data ?? [];

  return (
    <DashboardShell role="admin" title="Vendors">
      <div className="mb-4 flex justify-end"><Link href="/admin/vendors/new" className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm">New vendor</Link></div>
      <AdminVendorsTable rows={vendors} />
    </DashboardShell>
  );
}

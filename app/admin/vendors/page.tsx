import Link from "next/link";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { DeleteVendorButton } from "@/components/admin/DeleteVendorButton";
import { StatusBadge } from "@/components/ui/StatusBadge";
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
      <Table rows={vendors} />
    </DashboardShell>
  );
}

function Table({ rows }: { rows: any[] }) {
  return <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm"><table className="w-full text-left text-sm"><thead className="bg-panel text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Company</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Commission</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-line">{rows.map((vendor) => <tr key={vendor.id} className="hover:bg-panel/70"><td className="px-4 py-3"><Link className="font-medium hover:underline" href={`/admin/vendors/${vendor.id}`}>{vendor.company_name}</Link></td><td className="px-4 py-3">{vendor.email}</td><td className="px-4 py-3">{vendor.commission_rate}%</td><td className="px-4 py-3"><StatusBadge status={vendor.status} /></td><td className="px-4 py-3 text-right"><DeleteVendorButton vendorId={vendor.id} vendorName={vendor.company_name} /></td></tr>)}</tbody></table></div>;
}

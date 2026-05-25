import { DashboardShell } from "@/components/layout/DashboardShell";
import { DeleteVendorButton } from "@/components/admin/DeleteVendorButton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const { id } = await params;
  const supabase = await createClient();
  const { data: vendor } = await supabase.from("vendors").select("*, vendor_products(*), vendor_orders(*)").eq("id", id).single();

  return (
    <DashboardShell role="admin" title={vendor?.company_name ?? "Vendor"}>
      <div className="rounded-lg border border-line bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{vendor?.company_name}</h2>
          <div className="flex items-center gap-3">
            <StatusBadge status={vendor?.status} />
            {vendor?.id && <DeleteVendorButton vendorId={vendor.id} vendorName={vendor.company_name} redirectToList />}
          </div>
        </div>
        <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
          <div><dt className="text-slate-500">Contact</dt><dd>{vendor?.contact_name}</dd></div>
          <div><dt className="text-slate-500">Email</dt><dd>{vendor?.email}</dd></div>
          <div><dt className="text-slate-500">Shopify vendor</dt><dd>{vendor?.shopify_vendor_name}</dd></div>
          <div><dt className="text-slate-500">Commission</dt><dd>{vendor?.commission_rate}%</dd></div>
          <div><dt className="text-slate-500">City</dt><dd>{vendor?.city}</dd></div>
          <div><dt className="text-slate-500">Country</dt><dd>{vendor?.country}</dd></div>
        </dl>
      </div>
    </DashboardShell>
  );
}

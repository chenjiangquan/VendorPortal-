import { DashboardShell } from "@/components/layout/DashboardShell";
import { requireVendor } from "@/lib/auth";

export default async function VendorSettingsPage() {
  const { vendor } = await requireVendor();
  return <DashboardShell role="vendor" title="Settings"><div className="rounded-lg border border-line bg-white p-5"><h2 className="font-semibold">{vendor.company_name}</h2><p className="mt-2 text-sm text-slate-500">Vendor profile editing is constrained by RLS to contact, phone, website, address, city, and postcode fields.</p></div></DashboardShell>;
}

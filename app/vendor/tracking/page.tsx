import { DashboardShell } from "@/components/layout/DashboardShell";
import { TrackingStatusBadge } from "@/components/tracking/TrackingStatusBadge";
import { requireVendor } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";

export default async function VendorTrackingPage() {
  const { vendor } = await requireVendor();
  const supabase = await createClient();
  const { data } = await supabase.from("tracking_submissions").select("*, vendor_orders(shopify_order_name)").eq("vendor_id", vendor.id).order("submitted_at", { ascending: false });
  const rows = data ?? [];
  return (
    <DashboardShell role="vendor" title="Tracking">
      <div className="grid gap-4">{rows.map((row: any) => <div key={row.id} className="rounded-lg border border-line bg-white p-5"><div className="flex justify-between"><h2 className="font-semibold">{row.vendor_orders?.shopify_order_name}</h2><TrackingStatusBadge status={row.status} /></div><p className="mt-2 text-sm text-slate-500">{row.carrier} · {row.tracking_number} · {formatDate(row.submitted_at)}</p>{row.admin_note && <p className="mt-2 text-sm text-red-700">{row.admin_note}</p>}</div>)}</div>
    </DashboardShell>
  );
}

import { TrackingActions } from "@/app/admin/tracking/tracking-actions";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { TrackingStatusBadge } from "@/components/tracking/TrackingStatusBadge";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";

export default async function AdminTrackingPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const { data } = await supabase.from("tracking_submissions").select("*, vendors(company_name), vendor_orders(*, vendor_order_items(*))").order("submitted_at", { ascending: false });
  const rows = data ?? [];
  return (
    <DashboardShell role="admin" title="Tracking Review">
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">First version does not automatically fulfill Shopify orders. After reviewing tracking, please fulfill the order manually in Shopify Admin.</div>
      <div className="grid gap-4">{rows.map((row: any) => <div key={row.id} className="rounded-lg border border-line bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">{row.vendors?.company_name} · {row.vendor_orders?.shopify_order_name}</h2><p className="text-sm text-slate-500">{row.carrier} · {row.tracking_number} · {formatDate(row.submitted_at)}</p></div><TrackingStatusBadge status={row.status} /></div><p className="mt-3 text-sm text-slate-600">{row.note}</p>{row.tracking_url && <a href={row.tracking_url} className="mt-2 inline-block text-sm font-medium text-blue-700">Open tracking URL</a>}<TrackingActions id={row.id} status={row.status} /></div>)}</div>
    </DashboardShell>
  );
}

import { DashboardShell } from "@/components/layout/DashboardShell";
import { OrderDetail } from "@/components/orders/OrderDetail";
import { TrackingForm } from "@/components/tracking/TrackingForm";
import { requireVendor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function VendorOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { vendor } = await requireVendor();
  const { id } = await params;
  const supabase = await createClient();
  const { data: order } = await supabase.from("vendor_orders").select("*, vendor_order_items(*), tracking_submissions(*)").eq("id", id).eq("vendor_id", vendor.id).single();
  return <DashboardShell role="vendor" title={order?.shopify_order_name ?? "Order"}><div className="grid gap-5"><OrderDetail order={order} />{order?.status === "open" && <TrackingForm orderId={order.id} />}</div></DashboardShell>;
}

import { DashboardShell } from "@/components/layout/DashboardShell";
import { OrderDetail } from "@/components/orders/OrderDetail";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const { id } = await params;
  const supabase = await createClient();
  const { data: order } = await supabase.from("vendor_orders").select("*, vendor_order_items(*)").eq("id", id).single();
  return <DashboardShell role="admin" title={order?.shopify_order_name ?? "Order"}><OrderDetail order={order} /></DashboardShell>;
}

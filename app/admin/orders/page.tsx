import { SyncOrdersButton } from "@/app/admin/orders/sync-orders-button";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { OrderTable } from "@/components/orders/OrderTable";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminOrdersPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const { data } = await supabase.from("vendor_orders").select("*, vendors(company_name)").order("ordered_at", { ascending: false });
  const orders = data ?? [];
  return <DashboardShell role="admin" title="Orders"><div className="mb-4 flex justify-end"><SyncOrdersButton /></div><OrderTable orders={orders} basePath="/admin/orders" /></DashboardShell>;
}

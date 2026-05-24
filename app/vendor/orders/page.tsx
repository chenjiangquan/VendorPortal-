import { DashboardShell } from "@/components/layout/DashboardShell";
import { OrderTable } from "@/components/orders/OrderTable";
import { requireVendor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function VendorOrdersPage() {
  const { vendor } = await requireVendor();
  const supabase = await createClient();
  const { data } = await supabase.from("vendor_orders").select("*").eq("vendor_id", vendor.id).order("ordered_at", { ascending: false });
  const orders = data ?? [];
  return <DashboardShell role="vendor" title="Orders"><OrderTable orders={orders} basePath="/vendor/orders" /></DashboardShell>;
}

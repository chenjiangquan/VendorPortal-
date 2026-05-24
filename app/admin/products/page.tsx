import Link from "next/link";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminProductsPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const { data } = await supabase.from("vendor_products").select("*, vendors(company_name)").order("created_at", { ascending: false });
  const products = data ?? [];
  return (
    <DashboardShell role="admin" title="Products">
      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm"><table className="w-full text-left text-sm"><thead className="bg-panel text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Product</th><th className="px-4 py-3">Vendor</th><th className="px-4 py-3">SKU</th><th className="px-4 py-3">Price</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Created</th></tr></thead><tbody className="divide-y divide-line">{products.map((product: any) => <tr key={product.id} className="hover:bg-panel/70"><td className="px-4 py-3"><Link href={`/admin/products/${product.id}`} className="font-medium hover:underline">{product.title}</Link></td><td className="px-4 py-3">{product.vendors?.company_name}</td><td className="px-4 py-3">{product.sku}</td><td className="px-4 py-3">{formatCurrency(product.price)}</td><td className="px-4 py-3"><StatusBadge status={product.status} /></td><td className="px-4 py-3">{formatDate(product.created_at)}</td></tr>)}</tbody></table></div>
    </DashboardShell>
  );
}

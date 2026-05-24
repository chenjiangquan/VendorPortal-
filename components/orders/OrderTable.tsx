import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/utils";

export function OrderTable({ orders, basePath }: { orders: any[]; basePath: string }) {
  if (!orders.length) {
    return <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-slate-500 shadow-sm">No orders found.</div>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="bg-panel text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Order</th>
            <th className="px-4 py-3">Customer</th>
            <th className="px-4 py-3">Subtotal</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Ordered</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {orders.map((order) => (
            <tr key={order.id} className="hover:bg-panel/70">
              <td className="px-4 py-3">
                <Link className="font-medium text-ink hover:underline" href={`${basePath}/${order.id}`}>
                  {order.shopify_order_name}
                </Link>
              </td>
              <td className="px-4 py-3 text-slate-600">{order.customer_name}</td>
              <td className="px-4 py-3">{formatCurrency(order.vendor_subtotal, order.currency)}</td>
              <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
              <td className="px-4 py-3 text-slate-500">{formatDate(order.ordered_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

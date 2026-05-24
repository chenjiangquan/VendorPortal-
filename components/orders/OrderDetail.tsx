import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/utils";

export function OrderDetail({ order }: { order: any }) {
  const address = order.shipping_address ?? {};
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <section className="rounded-2xl border border-line bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{order.shopify_order_name}</h2>
            <p className="text-sm text-slate-500">{formatDate(order.ordered_at)}</p>
          </div>
          <StatusBadge status={order.status} />
        </div>
        <div className="mt-5 overflow-hidden rounded-xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel text-xs uppercase text-slate-500">
              <tr><th className="px-3 py-2">Item</th><th className="px-3 py-2">SKU</th><th className="px-3 py-2">Qty</th><th className="px-3 py-2">Total</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(order.vendor_order_items ?? []).map((item: any) => (
                <tr key={item.id}>
                  <td className="px-3 py-2">{item.title}</td>
                  <td className="px-3 py-2 text-slate-500">{item.sku}</td>
                  <td className="px-3 py-2">{item.quantity}</td>
                  <td className="px-3 py-2">{formatCurrency(item.total, order.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <aside className="rounded-2xl border border-line bg-white p-6 shadow-sm">
        <h3 className="font-semibold">Fulfilment details</h3>
        <dl className="mt-4 space-y-3 text-sm">
          <div><dt className="text-slate-500">Customer</dt><dd>{order.customer_name}</dd></div>
          <div><dt className="text-slate-500">Shipping address</dt><dd>{[address.name, address.address1, address.address2, address.city, address.province, address.zip, address.country].filter(Boolean).join(", ")}</dd></div>
          <div><dt className="text-slate-500">Email</dt><dd>{order.customer_email}</dd></div>
        </dl>
      </aside>
    </div>
  );
}

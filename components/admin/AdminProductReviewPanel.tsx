"use client";

import { useRouter } from "next/navigation";
import { Check, Sparkles, X, Archive, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export function AdminProductReviewPanel({ product }: { product: any }) {
  const router = useRouter();

  async function post(path: string, body?: Record<string, unknown>) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(json.error ?? "Action failed.");
      return null;
    }
    toast.success(json.message ?? "Done.");
    router.refresh();
    return json;
  }

  return (
    <aside className="rounded-2xl border border-line bg-white p-6 shadow-sm">
      <h2 className="font-semibold">Admin review</h2>
      <div className="mt-4 space-y-2">
        <button onClick={() => post(`/api/admin/products/${product.id}/approve`)} disabled={product.status !== "submitted"} className="flex w-full items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50"><Check className="h-4 w-4" />Approve</button>
        <button onClick={() => post(`/api/admin/products/${product.id}/reject`, { rejection_reason: prompt("Reject reason") ?? "" })} disabled={product.status !== "submitted"} className="flex w-full items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50"><X className="h-4 w-4" />Reject</button>
        <button onClick={() => post(`/api/admin/products/${product.id}/create-shopify-draft`)} disabled={product.status !== "approved"} className="flex w-full items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50"><Archive className="h-4 w-4" />Create Shopify Draft</button>
        <button onClick={() => post("/api/admin/ai/optimise-product", { product_id: product.id }).then((json) => json && toast.message("AI output ready", { description: "Review API response in network logs or extend UI to apply it." }))} className="flex w-full items-center gap-2 rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold shadow-sm"><Sparkles className="h-4 w-4" />AI Optimise</button>
        {product.shopifyAdminUrl && (
          <a href={product.shopifyAdminUrl} className="flex w-full items-center gap-2 rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold shadow-sm">
            <ExternalLink className="h-4 w-4" />Open in Shopify
          </a>
        )}
      </div>
      <p className="mt-4 text-sm text-slate-500">Create Shopify Draft only appears enabled for approved products and is idempotent server-side.</p>
    </aside>
  );
}

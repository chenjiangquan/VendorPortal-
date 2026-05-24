"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sparkles, X, Archive, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export function AdminProductReviewPanel({ product }: { product: any }) {
  const router = useRouter();
  const [technicalError, setTechnicalError] = useState<unknown>(null);

  async function post(path: string, body?: Record<string, unknown>) {
    setTechnicalError(null);
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(json.error ?? "Action failed.");
      if (json.details) {
        console.error(json.details);
        setTechnicalError(json.details);
      }
      return null;
    }
    toast.success(json.message ?? "Done.");
    if (json.warning) toast.warning(json.warning);
    router.refresh();
    return json;
  }

  return (
    <aside className="rounded-2xl border border-line bg-white p-6 shadow-sm">
      <h2 className="font-semibold">Admin review</h2>
      <div className="mt-4 space-y-2">
        {product.status !== "shopify_draft" && (
          <button onClick={() => post(`/api/admin/products/${product.id}/create-shopify-draft`)} disabled={product.status !== "submitted" || Boolean(product.shopify_product_gid)} className="flex w-full items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50"><Archive className="h-4 w-4" />Create Shopify Draft</button>
        )}
        <button onClick={() => post(`/api/admin/products/${product.id}/reject`, { rejection_reason: prompt("Reject reason") ?? "" })} disabled={product.status !== "submitted"} className="flex w-full items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50"><X className="h-4 w-4" />Reject</button>
        <button onClick={() => post("/api/admin/ai/optimise-product", { product_id: product.id }).then((json) => json && toast.message("AI output ready", { description: "Review API response in network logs or extend UI to apply it." }))} className="flex w-full items-center gap-2 rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold shadow-sm"><Sparkles className="h-4 w-4" />AI Optimise</button>
        {product.shopifyAdminUrl && (
          <a href={product.shopifyAdminUrl} className="flex w-full items-center gap-2 rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold shadow-sm">
            <ExternalLink className="h-4 w-4" />View Shopify Draft
          </a>
        )}
      </div>
      <div className="mt-4 space-y-2 text-sm text-slate-500">
        <p>Creates a draft product in Shopify Admin. The product will not be published on the storefront until you activate it in Shopify.</p>
        <p>Reject and send reason back to vendor.</p>
      </div>
      {technicalError ? (
        <details className="mt-4 rounded-xl border border-line bg-panel p-3 text-xs">
          <summary className="cursor-pointer font-semibold text-slate-700">Show technical error</summary>
          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap text-slate-600">{JSON.stringify(technicalError, null, 2)}</pre>
        </details>
      ) : null}
    </aside>
  );
}

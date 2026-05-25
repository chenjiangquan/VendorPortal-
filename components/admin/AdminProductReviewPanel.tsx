"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sparkles, X, Archive, ExternalLink } from "lucide-react";
import { toast } from "sonner";

type AiOutput = {
  improved_title?: string;
  product_overview?: string[] | string;
  details?: { label?: string; value?: string }[];
  seo_title?: string;
  seo_description?: string;
  tags?: string[];
  google_product_category?: string;
  image_alt_texts?: string[];
};

export function AdminProductReviewPanel({ product }: { product: any }) {
  const router = useRouter();
  const [technicalError, setTechnicalError] = useState<unknown>(null);
  const [shopifyWarnings, setShopifyWarnings] = useState<string[]>(Array.isArray(product.shopifyWarnings) ? product.shopifyWarnings : []);
  const [aiOutput, setAiOutput] = useState<AiOutput | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [applyingAi, setApplyingAi] = useState(false);

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
    if (Array.isArray(json.warnings) && json.warnings.length) {
      setShopifyWarnings(json.warnings);
      toast.warning("Shopify Draft created with warnings. Please review the Shopify product.");
    }
    router.refresh();
    return json;
  }

  async function optimiseWithAi() {
    setAiLoading(true);
    setTechnicalError(null);
    const res = await fetch("/api/admin/ai/optimise-product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: product.id })
    });
    const json = await res.json().catch(() => ({}));
    setAiLoading(false);
    if (!res.ok) {
      toast.error(json.error ?? "AI optimisation failed.");
      if (json.details) setTechnicalError(json.details);
      return;
    }
    setAiOutput(json);
    toast.success("AI output ready.");
  }

  async function applyAiOutput() {
    if (!aiOutput) return;
    setApplyingAi(true);
    const res = await fetch("/api/admin/ai/apply-product-output", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: product.id, output: aiOutput })
    });
    const json = await res.json().catch(() => ({}));
    setApplyingAi(false);
    if (!res.ok) {
      toast.error(json.error ?? "Could not apply AI output.");
      if (json.details) setTechnicalError(json.details);
      return;
    }
    toast.success(json.message ?? "AI output applied successfully.");
    setAiOutput(null);
    router.refresh();
  }

  return (
    <aside className="rounded-2xl border border-line bg-white p-6 shadow-sm">
      <h2 className="font-semibold">Admin review</h2>
      <div className="mt-4 space-y-2">
        {product.status !== "shopify_draft" && (
          <button onClick={() => post(`/api/admin/products/${product.id}/create-shopify-draft`)} disabled={product.status !== "submitted" || Boolean(product.shopify_product_gid)} className="flex w-full items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50"><Archive className="h-4 w-4" />Create Shopify Draft</button>
        )}
        <button onClick={() => post(`/api/admin/products/${product.id}/reject`, { rejection_reason: "" })} disabled={product.status !== "submitted"} className="flex w-full items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50"><X className="h-4 w-4" />Reject</button>
        <button onClick={optimiseWithAi} disabled={aiLoading || applyingAi} className="flex w-full items-center gap-2 rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold shadow-sm disabled:opacity-50"><Sparkles className="h-4 w-4" />{aiLoading ? "Optimising..." : "AI Optimise"}</button>
        {product.shopifyAdminUrl && (
          <a href={product.shopifyAdminUrl} className="flex w-full items-center gap-2 rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold shadow-sm">
            <ExternalLink className="h-4 w-4" />View Shopify Draft
          </a>
        )}
      </div>
      <div className="mt-4 space-y-2 text-sm text-slate-500">
        <p>Creates a draft product in Shopify Admin. The product will not be published on the storefront until you activate it in Shopify.</p>
        <p>Reject and send the product back to vendor for changes.</p>
      </div>
      {shopifyWarnings.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <h3 className="font-semibold">Shopify sync warnings</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {shopifyWarnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </div>
      )}
      {aiOutput && (
        <section className="mt-5 rounded-2xl border border-line bg-panel p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold text-ink">AI Output Preview</h3>
            <button onClick={() => setAiOutput(null)} className="text-xs font-semibold text-slate-500 hover:text-ink">Cancel</button>
          </div>
          <div className="mt-4 space-y-4 text-sm">
            <PreviewBlock title="Improved title">{aiOutput.improved_title || product.title}</PreviewBlock>
            <PreviewList title="Product overview" items={normalisePreviewList(aiOutput.product_overview)} />
            <PreviewDetails details={aiOutput.details ?? []} />
            <PreviewBlock title="SEO title">{aiOutput.seo_title || product.seo_title || "-"}</PreviewBlock>
            <PreviewBlock title="SEO description">{aiOutput.seo_description || product.seo_description || "-"}</PreviewBlock>
            <PreviewList title="Tags" items={aiOutput.tags ?? []} inline />
            <PreviewBlock title="Google product category">{aiOutput.google_product_category || product.google_product_category || "-"}</PreviewBlock>
            <PreviewList title="Image alt texts" items={aiOutput.image_alt_texts ?? []} />
          </div>
          <button onClick={applyAiOutput} disabled={applyingAi} className="mt-4 w-full rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50">
            {applyingAi ? "Applying..." : "Apply AI Output"}
          </button>
        </section>
      )}
      {technicalError ? (
        <details className="mt-4 rounded-xl border border-line bg-panel p-3 text-xs">
          <summary className="cursor-pointer font-semibold text-slate-700">Show technical error</summary>
          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap text-slate-600">{JSON.stringify(technicalError, null, 2)}</pre>
        </details>
      ) : null}
    </aside>
  );
}

function PreviewBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><h4 className="text-xs font-semibold uppercase text-slate-500">{title}</h4><p className="mt-1 text-slate-700">{children}</p></div>;
}

function PreviewList({ title, items, inline }: { title: string; items: string[]; inline?: boolean }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase text-slate-500">{title}</h4>
      {items.length ? (
        inline ? <div className="mt-2 flex flex-wrap gap-1">{items.map((item) => <span key={item} className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-700">{item}</span>)}</div>
          : <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">{items.map((item) => <li key={item}>{item}</li>)}</ul>
      ) : <p className="mt-1 text-slate-500">No change</p>}
    </div>
  );
}

function PreviewDetails({ details }: { details: { label?: string; value?: string }[] }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase text-slate-500">Details table</h4>
      {details.length ? (
        <table className="mt-2 w-full overflow-hidden rounded-xl bg-white text-left text-xs">
          <tbody>{details.map((row, index) => <tr key={`${row.label}-${index}`} className="border-b border-line last:border-0"><td className="px-2 py-2 font-semibold">{row.label}</td><td className="px-2 py-2">{row.value}</td></tr>)}</tbody>
        </table>
      ) : <p className="mt-1 text-slate-500">No change</p>}
    </div>
  );
}

function normalisePreviewList(value?: string[] | string) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") return value.split(/\r?\n/).map((line) => line.replace(/^[-*]\s*/, "").trim()).filter(Boolean);
  return [];
}

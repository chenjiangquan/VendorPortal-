"use client";

import { Sparkles, X } from "lucide-react";
import { RefObject, useRef, useState } from "react";
import { toast } from "sonner";
import { ProductImageDraft } from "@/components/products/ProductImageUploader";
import { DescriptionData } from "@/lib/product-description";
import { useI18n } from "@/lib/i18n";

type AiCopyResult = {
  title?: string;
  overview?: string[];
};

export function AiProductCopyButton({
  images,
  title,
  overviewText,
  details,
  targetProductType,
  targetProductDescription,
  target = "both",
  formRef,
  readOnly,
  onApply
}: {
  images: ProductImageDraft[];
  title: string;
  overviewText: string;
  details: DescriptionData["details"];
  targetProductType?: string;
  targetProductDescription?: string;
  target?: "title" | "overview" | "both";
  formRef: RefObject<HTMLFormElement | null>;
  readOnly?: boolean;
  onApply: (result: { title?: string; overviewText?: string }) => void;
}) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<AiCopyResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const canGenerate = images.length > 0 && !readOnly;

  async function generateCopy() {
    if (loading) return;
    if (!canGenerate) {
      toast.error(t("ai.uploadImageFirst"));
      return;
    }

    const categoryInput = formRef.current?.elements.namedItem("category") as HTMLInputElement | null;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setResult(null);
    setOpen(true);
    setLoading(true);
    try {
      const res = await fetch("/api/vendor/ai/generate-product-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          title,
          overview: overviewText,
          details,
          copy_target: target,
          target_product_type: targetProductType,
          target_product_description: targetProductDescription,
          category: categoryInput?.value ?? "",
          images: images.map((image) => ({
            url: image.url,
            storage_path: image.storage_path,
            alt_text: image.alt_text ?? ""
          }))
        })
      });
      const json = await res.json().catch(() => ({}));
      if (controller.signal.aborted) return;
      if (!res.ok) {
        toast.error(json.error ?? "AI product copy generation failed.");
        return;
      }

      setResult(json);
      toast.success(t("ai.copyReady"));
    } catch (error) {
      if (controller.signal.aborted) return;
      toast.error(error instanceof Error ? error.message : "AI product copy generation failed.");
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setLoading(false);
      }
    }
  }

  function applyResult() {
    if (!result) return;
    onApply({
      title: target === "overview" ? undefined : result.title,
      overviewText: target === "title" ? undefined : result.overview?.map((item) => `• ${item.replace(/^[-*•]\s*/, "").trim()}`).join("\n")
    });
    setResult(null);
    setOpen(false);
    toast.success(t("ai.copyApplied"));
  }

  function closeModal() {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setResult(null);
    setOpen(false);
  }

  return (
    <>
      <span className="group relative inline-flex">
        <button
          type="button"
          onClick={generateCopy}
          disabled={!canGenerate || loading}
          className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold shadow-sm transition hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          {loading ? t("ai.generating") : t("ai.generateCopy")}
        </button>
        {!canGenerate && !readOnly && (
          <span className="pointer-events-none absolute right-0 top-full z-30 mt-2 hidden w-72 rounded-xl border border-line bg-ink px-3 py-2 text-xs font-medium text-white shadow-xl group-hover:block group-focus-within:block">
            {t("ai.uploadImageFirst")}
          </span>
        )}
      </span>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-line bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-ink">{t("ai.copyTitle")}</h3>
                <p className="mt-1 text-sm text-slate-500">{t("ai.copyReview")}</p>
              </div>
              <button type="button" onClick={closeModal} className="rounded-lg p-2 text-slate-500 hover:bg-panel hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {loading && !result && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
                  {t("ai.copyGeneratingNotice")}
                </div>
              )}
              {target !== "overview" && result?.title && (
                <div className="rounded-xl border border-line p-4">
                  <div className="text-xs font-semibold uppercase text-slate-500">{t("product.title")}</div>
                  <p className="mt-2 text-sm font-medium text-ink">{result.title}</p>
                </div>
              )}
              {target !== "title" && result?.overview?.length ? (
                <div className="rounded-xl border border-line p-4">
                  <div className="text-xs font-semibold uppercase text-slate-500">{t("product.productOverview")}</div>
                  <div className="mt-2 space-y-1 text-sm text-ink">
                    {result.overview.map((item, index) => <p key={`${item}-${index}`}>• {item.replace(/^[-*•]\s*/, "").trim()}</p>)}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={generateCopy} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold shadow-sm disabled:opacity-50">
                <Sparkles className="h-4 w-4" />
                {loading ? t("ai.generating") : t("ai.generateAnother")}
              </button>
              <button type="button" onClick={closeModal} className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold shadow-sm">{t("common.cancel")}</button>
              <button type="button" onClick={applyResult} disabled={!result || loading} className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50">{t("ai.applyOutput")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import Image from "next/image";
import { ImagePlus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ProductImageDraft } from "@/components/products/ProductImageUploader";
import { useI18n } from "@/lib/i18n";

type AiImageMode = "studio" | "scene" | "closeup" | "material" | "dimensions";

const modes: { value: AiImageMode; labelKey: any; descriptionKey: any }[] = [
  { value: "studio", labelKey: "ai.studio", descriptionKey: "ai.studioDesc" },
  { value: "scene", labelKey: "ai.scene", descriptionKey: "ai.sceneDesc" },
  { value: "closeup", labelKey: "ai.closeup", descriptionKey: "ai.closeupDesc" },
  { value: "material", labelKey: "ai.material", descriptionKey: "ai.materialDesc" },
  { value: "dimensions", labelKey: "ai.dimensions", descriptionKey: "ai.dimensionsDesc" }
];

export function AiImageGenerator({
  images,
  productId,
  title,
  category,
  onGenerated,
  readOnly
}: {
  images: ProductImageDraft[];
  productId?: string;
  title?: string;
  category?: string;
  onGenerated: (image: ProductImageDraft) => void;
  readOnly?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AiImageMode>("scene");
  const [sourceImageId, setSourceImageId] = useState("");
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [targetProductType, setTargetProductType] = useState("");
  const [targetProductDescription, setTargetProductDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<ProductImageDraft | null>(null);
  const canGenerate = images.length > 0 && !readOnly;
  const selectedSource = images.find((image) => image.id === sourceImageId) ?? images[0];

  function openModal() {
    if (!canGenerate) {
      toast.error(t("ai.imageUploadFirst"));
      return;
    }
    setSourceImageId(images[0]?.id ?? "");
    setOpen(true);
  }

  async function generateImage() {
    if (!selectedSource) return;
    if (mode === "dimensions" && (!length.trim() || !width.trim() || !height.trim())) {
      toast.error("Please enter length, width and height for dimensions images.");
      return;
    }

    setLoading(true);
    setPreviewImage(null);
    const res = await fetch("/api/vendor/ai/generate-product-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: productId ?? null,
        title,
        category,
        target_product_type: targetProductType,
        target_product_description: targetProductDescription,
        mode,
        source_image: {
          url: selectedSource.url,
          storage_path: selectedSource.storage_path,
          alt_text: selectedSource.alt_text ?? ""
        },
        dimensions: { length, width, height }
      })
    });
    const json = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      toast.error(json.error ?? "AI image generation failed.");
      return;
    }

    setPreviewImage({ ...json.image, action: "add" });
    toast.success(t("ai.imageGenerated"));
  }

  function usePreviewImage() {
    if (!previewImage) return;
    onGenerated(previewImage);
    toast.success(t("ai.imageAdded"));
    setOpen(false);
    setPreviewImage(null);
  }

  return (
    <>
      <span className="group relative inline-flex">
        <button
          type="button"
          disabled={!canGenerate}
          onClick={openModal}
          className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold shadow-sm transition hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ImagePlus className="h-4 w-4" />
          {t("ai.imageButton")}
        </button>
        {!canGenerate && !readOnly && (
          <span className="pointer-events-none absolute left-0 top-full z-30 mt-2 hidden w-72 rounded-xl border border-line bg-ink px-3 py-2 text-xs font-medium text-white shadow-xl group-hover:block group-focus-within:block">
            {t("ai.imageUploadFirst")}
          </span>
        )}
      </span>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-line bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-ink">{t("ai.imageTitle")}</h3>
                <p className="mt-1 text-sm text-slate-500">{t("ai.imageHelp")}</p>
              </div>
              <button type="button" disabled={loading} onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-panel hover:text-ink disabled:opacity-50">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[220px_1fr]">
              <div>
                <div className="text-sm font-semibold text-ink">{t("ai.sourceImage")}</div>
                <div className="mt-3 grid grid-cols-3 gap-2 lg:grid-cols-2">
                  {images.map((image) => (
                    <button
                      key={image.id}
                      type="button"
                      disabled={loading}
                      onClick={() => setSourceImageId(image.id)}
                      className={`relative aspect-square overflow-hidden rounded-xl border disabled:cursor-not-allowed disabled:opacity-60 ${selectedSource?.id === image.id ? "border-ink ring-2 ring-ink/10" : "border-line"}`}
                    >
                      <Image src={image.url} alt={image.alt_text ?? "Source image"} fill className="object-cover" unoptimized={image.is_temporary} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-line bg-panel p-4">
                  <div>
                    <div className="text-sm font-semibold text-ink">{t("ai.targetTitle")}</div>
                    <p className="mt-1 text-xs text-slate-500">{t("ai.targetHelp")}</p>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-[180px_1fr]">
                    <label>
                      <span className="text-xs font-semibold text-slate-600">{t("ai.targetType")}</span>
                      <select
                        value={targetProductType}
                        disabled={loading}
                        onChange={(event) => setTargetProductType(event.target.value)}
                        className="focus-ring mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm shadow-sm disabled:bg-panel"
                      >
                        <option value="">{t("ai.targetTypeAuto")}</option>
                        <option value="table">{t("ai.targetTypeTable")}</option>
                        <option value="chair">{t("ai.targetTypeChair")}</option>
                        <option value="sofa">{t("ai.targetTypeSofa")}</option>
                        <option value="bed">{t("ai.targetTypeBed")}</option>
                        <option value="cabinet">{t("ai.targetTypeCabinet")}</option>
                        <option value="lighting">{t("ai.targetTypeLighting")}</option>
                        <option value="decor">{t("ai.targetTypeDecor")}</option>
                        <option value="other">{t("ai.targetTypeOther")}</option>
                      </select>
                    </label>
                    <label>
                      <span className="text-xs font-semibold text-slate-600">{t("ai.targetDescription")}</span>
                      <input
                        value={targetProductDescription}
                        disabled={loading}
                        onChange={(event) => setTargetProductDescription(event.target.value)}
                        placeholder={t("ai.targetDescriptionPlaceholder")}
                        className="focus-ring mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm shadow-sm disabled:bg-panel"
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-semibold text-ink">{t("ai.imageType")}</div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {modes.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        disabled={loading}
                        onClick={() => setMode(item.value)}
                        className={`rounded-xl border px-4 py-3 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${mode === item.value ? "border-ink bg-ink text-white" : "border-line bg-white hover:bg-panel"}`}
                      >
                        <div className="font-semibold">{t(item.labelKey)}</div>
                        <div className={`mt-1 text-xs ${mode === item.value ? "text-white/70" : "text-slate-500"}`}>{t(item.descriptionKey)}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {mode === "dimensions" && (
                  <div className="rounded-xl border border-line bg-panel p-4">
                    <div className="text-sm font-semibold text-ink">{t("ai.dimensionsRequired")}</div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <DimensionInput label={t("ai.length")} value={length} onChange={setLength} disabled={loading} />
                      <DimensionInput label={t("ai.width")} value={width} onChange={setWidth} disabled={loading} />
                      <DimensionInput label={t("ai.height")} value={height} onChange={setHeight} disabled={loading} />
                    </div>
                  </div>
                )}
                {loading && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800">{t("ai.generatingNotice")}</div>}
                {previewImage && (
                  <div className="rounded-2xl border border-line bg-panel p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-ink">{t("ai.previewTitle")}</div>
                        <p className="text-xs text-slate-500">{t("ai.previewHelp")}</p>
                      </div>
                    </div>
                    <div className="relative aspect-square overflow-hidden rounded-xl border border-line bg-white">
                      <Image src={previewImage.url} alt={previewImage.alt_text ?? "AI generated product image"} fill className="object-contain" unoptimized />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" disabled={loading} onClick={() => setOpen(false)} className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold shadow-sm disabled:opacity-50">{t("common.cancel")}</button>
              <button type="button" onClick={generateImage} disabled={loading} className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50">
                {loading ? t("ai.generating") : previewImage ? t("ai.generateAnotherImage") : t("ai.generateImage")}
              </button>
              {previewImage && (
                <button type="button" onClick={usePreviewImage} disabled={loading} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50">
                  {t("ai.useImage")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DimensionInput({ label, value, onChange, disabled }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <label>
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      <input disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} placeholder="e.g. 80cm" className="focus-ring mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm shadow-sm disabled:bg-panel" />
    </label>
  );
}

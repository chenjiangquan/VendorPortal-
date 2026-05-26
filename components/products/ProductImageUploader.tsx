"use client";

import Image from "next/image";
import { useState } from "react";
import { GripVertical, X, Upload } from "lucide-react";
import { toast } from "sonner";
import { AiImageGenerator } from "@/components/products/AiImageGenerator";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";

export type ProductImageDraft = {
  id: string;
  url: string;
  storage_path?: string | null;
  alt_text?: string | null;
  position?: number;
  action?: "keep" | "add" | "update" | "remove";
  is_temporary?: boolean;
};

export function ProductImageUploader({
  productId,
  vendorId,
  existing,
  readOnly,
  staging = false,
  onChange,
  onImagesChange,
  aiTitle,
  aiCategory
}: {
  productId?: string;
  vendorId: string;
  existing: ProductImageDraft[];
  readOnly?: boolean;
  staging?: boolean;
  onChange?: (count: number) => void;
  onImagesChange?: (images: ProductImageDraft[]) => void;
  aiTitle?: string;
  aiCategory?: string;
}) {
  const { t } = useI18n();
  const [images, setImages] = useState<ProductImageDraft[]>(sortImages(existing));
  const [uploading, setUploading] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<ProductImageDraft | null>(null);

  function commit(next: ProductImageDraft[]) {
    const sorted = next.map((image, index) => ({ ...image, position: index }));
    setImages(sorted);
    onChange?.(sorted.length);
    onImagesChange?.(sorted);
    if (productId && !staging) {
      fetch(`/api/vendor/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_positions: sorted.map((image, index) => ({ id: image.id, position: index })) })
      }).catch(() => toast.error("Could not save image order."));
    }
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    if (images.length + files.length > 12) {
      toast.error("Maximum 12 images.");
      return;
    }
    setUploading(true);
    const supabase = createClient();
    const uploaded: ProductImageDraft[] = [];
    for (const file of Array.from(files)) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        toast.error(`${file.name} is not jpg, png, or webp.`);
        continue;
      }
      if (file.size > 8 * 1024 * 1024) {
        toast.error(`${file.name} is larger than 8MB.`);
        continue;
      }
      const safeFileName = createSafeStorageFileName(file);
      const path = productId
        ? `${vendorId}/${productId}/${safeFileName}`
        : `${vendorId}/pending/${safeFileName}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file);
      if (error) {
        toast.error(error.message);
        continue;
      }
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      const draftImage = { id: crypto.randomUUID(), url: data.publicUrl, storage_path: path, alt_text: "", position: images.length + uploaded.length, action: "add" as const };
      if (!productId || staging) {
        uploaded.push(draftImage);
        continue;
      }
      const res: Response = await fetch(`/api/vendor/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: { url: data.publicUrl, storage_path: path, position: draftImage.position, alt_text: "" } })
      });
      const json: { image?: ProductImageDraft; error?: string } = await res.json();
      if (res.ok && json.image) uploaded.push(json.image);
      else toast.error(json.error ?? "Image upload saved to storage but could not be linked.");
    }
    setUploading(false);
    if (uploaded.length) {
      commit([...images, ...uploaded]);
      toast.success(productId ? "Images uploaded." : "Images uploaded. They will be attached when you save the product.");
    }
  }

  async function updateAlt(id: string, altText: string) {
    const next = images.map((image) => (image.id === id ? { ...image, alt_text: altText, action: image.action === "add" ? "add" as const : "update" as const } : image));
    setImages(next);
    onImagesChange?.(next);
    if (!productId || staging) return;
    const res = await fetch(`/api/vendor/products/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_alt: { id, alt_text: altText } })
    });
    if (!res.ok) toast.error("Could not update image alt text.");
  }

  async function remove(image: ProductImageDraft) {
    const supabase = createClient();
    if (!image.is_temporary && image.storage_path && (!staging || image.action === "add")) await supabase.storage.from("product-images").remove([image.storage_path]);
    if (productId && !staging) {
      const res = await fetch(`/api/vendor/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delete_image_id: image.id })
      });
      if (!res.ok) {
        toast.error("Could not remove image.");
        return;
      }
    }
    commit(images.filter((item) => item.id !== image.id));
    toast.success("Image removed.");
  }

  function moveByDrag(targetId: string) {
    if (!draggingId || draggingId === targetId) return;
    const from = images.findIndex((image) => image.id === draggingId);
    const to = images.findIndex((image) => image.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...images];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    commit(next);
  }

  return (
    <div className="md:col-span-2">
      {!readOnly && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-3">
            <label className="flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-panel p-6 text-center">
              <Upload className="h-6 w-6 text-slate-500" />
              <span className="mt-3 text-sm font-semibold text-ink">{uploading ? t("image.uploading") : t("image.upload")}</span>
              <span className="mt-1 text-xs text-slate-500">{t("image.uploadHelp")}</span>
              <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploading} onChange={(event) => upload(event.target.files)} />
            </label>
            <AiImageGenerator
              images={images}
              productId={staging ? undefined : productId}
              title={aiTitle}
              category={aiCategory}
              readOnly={readOnly}
              onGenerated={(image) => commit([...images, image])}
            />
          </div>

          <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
            <div className="relative aspect-[2/3] bg-panel">
              <Image src="/images/vendor-upload-example.jpg" alt="Product image reference example" fill className="object-contain" />
            </div>
            <div className="p-4">
              <h3 className="text-sm font-semibold text-ink">{t("image.referenceTitle")}</h3>
              <p className="mt-1 text-sm text-slate-500">{t("image.referenceHelp")}</p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {images.map((image, index) => (
          <div
            key={image.id}
            draggable={!readOnly}
            onDragStart={() => setDraggingId(image.id)}
            onDragEnd={() => setDraggingId(null)}
            onDragOver={(event) => {
              if (!readOnly) event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              moveByDrag(image.id);
              setDraggingId(null);
            }}
            onClick={() => setPreviewImage(image)}
            className={`group overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition ${draggingId === image.id ? "scale-[0.98] opacity-60" : ""} ${readOnly ? "" : "cursor-grab active:cursor-grabbing"}`}
          >
            <div className="relative aspect-square bg-panel">
              <Image src={image.url} alt={image.alt_text ?? "Product image"} fill className="object-cover" unoptimized={image.is_temporary} />
              <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs font-semibold shadow-sm">
                {!readOnly && <GripVertical className="h-3 w-3 text-slate-400" />}#{index + 1}
              </span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    remove(image);
                  }}
                  className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm transition hover:bg-red-50 hover:text-red-600"
                  title={t("image.remove")}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="p-3">
              <label className="block">
                <span className="text-xs font-medium text-slate-500">{t("image.altText")}</span>
                <input value={image.alt_text ?? ""} disabled={readOnly} onClick={(event) => event.stopPropagation()} onChange={(event) => updateAlt(image.id, event.target.value)} className="focus-ring mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm disabled:bg-panel" />
              </label>
            </div>
          </div>
        ))}
      </div>
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" onClick={() => setPreviewImage(null)}>
          <button type="button" onClick={() => setPreviewImage(null)} className="absolute right-5 top-5 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
            <X className="h-6 w-6" />
          </button>
          <div className="relative max-h-[90vh] w-full max-w-5xl" onClick={(event) => event.stopPropagation()}>
            <Image src={previewImage.url} alt={previewImage.alt_text ?? "Product image"} width={1400} height={1400} className="mx-auto max-h-[90vh] w-auto rounded-2xl object-contain" unoptimized={previewImage.is_temporary} />
          </div>
        </div>
      )}
    </div>
  );
}

function sortImages(images: ProductImageDraft[]) {
  return [...images].sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0));
}

function createSafeStorageFileName(file: File) {
  const extension = getImageExtension(file);
  return `${crypto.randomUUID()}.${extension}`;
}

function getImageExtension(file: File) {
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/png") return "png";
  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  return extension || "png";
}

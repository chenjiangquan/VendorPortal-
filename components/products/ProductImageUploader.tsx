"use client";

import Image from "next/image";
import { useState } from "react";
import { ArrowDown, ArrowUp, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export type ProductImageDraft = {
  id: string;
  url: string;
  storage_path: string;
  alt_text?: string | null;
  position?: number;
};

export function ProductImageUploader({
  productId,
  vendorId,
  existing,
  readOnly,
  onChange,
  onImagesChange
}: {
  productId?: string;
  vendorId: string;
  existing: ProductImageDraft[];
  readOnly?: boolean;
  onChange?: (count: number) => void;
  onImagesChange?: (images: ProductImageDraft[]) => void;
}) {
  const [images, setImages] = useState<ProductImageDraft[]>(sortImages(existing));
  const [uploading, setUploading] = useState(false);

  function commit(next: ProductImageDraft[]) {
    const sorted = next.map((image, index) => ({ ...image, position: index }));
    setImages(sorted);
    onChange?.(sorted.length);
    onImagesChange?.(sorted);
    if (productId) {
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
      const path = productId
        ? `${vendorId}/${productId}/${crypto.randomUUID()}-${file.name}`
        : `${vendorId}/pending/${crypto.randomUUID()}-${file.name}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file);
      if (error) {
        toast.error(error.message);
        continue;
      }
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      const draftImage = { id: crypto.randomUUID(), url: data.publicUrl, storage_path: path, alt_text: "", position: images.length + uploaded.length };
      if (!productId) {
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
    const next = images.map((image) => (image.id === id ? { ...image, alt_text: altText } : image));
    setImages(next);
    onImagesChange?.(next);
    if (!productId) return;
    const res = await fetch(`/api/vendor/products/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_alt: { id, alt_text: altText } })
    });
    if (!res.ok) toast.error("Could not update image alt text.");
  }

  async function remove(image: ProductImageDraft) {
    const supabase = createClient();
    if (image.storage_path) await supabase.storage.from("product-images").remove([image.storage_path]);
    if (productId) {
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

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  }

  return (
    <div className="md:col-span-2">
      {!readOnly && (
        <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-panel p-6 text-center">
          <Upload className="h-6 w-6 text-slate-500" />
          <span className="mt-3 text-sm font-semibold text-ink">{uploading ? "Uploading..." : "Upload images"}</span>
          <span className="mt-1 text-xs text-slate-500">Upload anytime. jpg, png or webp. Max 12 images, 8MB each.</span>
          <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploading} onChange={(event) => upload(event.target.files)} />
        </label>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        {images.map((image, index) => (
          <div key={image.id} className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
            <div className="relative aspect-square bg-panel">
              <Image src={image.url} alt={image.alt_text ?? "Product image"} fill className="object-cover" />
              <span className="absolute left-2 top-2 rounded-full bg-white px-2 py-1 text-xs font-semibold shadow-sm">#{index + 1}</span>
            </div>
            <div className="space-y-3 p-3">
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Alt text</span>
                <input value={image.alt_text ?? ""} disabled={readOnly} onChange={(event) => updateAlt(image.id, event.target.value)} className="focus-ring mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm disabled:bg-panel" />
              </label>
              {!readOnly && (
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={index === 0} onClick={() => move(index, -1)} className="rounded-xl border border-line p-2 shadow-sm disabled:opacity-40" title="Move up"><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" disabled={index === images.length - 1} onClick={() => move(index, 1)} className="rounded-xl border border-line p-2 shadow-sm disabled:opacity-40" title="Move down"><ArrowDown className="h-4 w-4" /></button>
                  <button type="button" onClick={() => remove(image)} className="inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm font-semibold shadow-sm">
                    <Trash2 className="h-4 w-4" /> Remove
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function sortImages(images: ProductImageDraft[]) {
  return [...images].sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0));
}

"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Lock, Plus, Save, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ProductImageDraft, ProductImageUploader } from "@/components/products/ProductImageUploader";
import { ProductOption, VariantEditor, VariantRow } from "@/components/products/VariantEditor";
import { DescriptionData, normaliseDescriptionData, normaliseOverviewLines } from "@/lib/product-description";

export function ProductForm({ product, mode = "create", readOnly = false, vendorId }: { product?: any; mode?: "create" | "edit" | "change-request"; readOnly?: boolean; vendorId?: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const initialDescription = useMemo(() => normaliseDescriptionData(product?.description_data), [product?.description_data]);
  const [overviewText, setOverviewText] = useState(initialDescription.overview.join("\n"));
  const [details, setDetails] = useState(initialDescription.details);
  const [imageCount, setImageCount] = useState(product?.product_images?.length ?? 0);
  const [pendingImages, setPendingImages] = useState<ProductImageDraft[]>([]);
  const [hasVariants, setHasVariants] = useState(Boolean(product?.has_variants));
  const [options, setOptions] = useState<ProductOption[]>(Array.isArray(product?.options) && product.options.length ? product.options : [{ name: "Size", values: [] }]);
  const [variants, setVariants] = useState<VariantRow[]>(product?.product_variants ?? []);
  const endpoint = mode === "create" ? "/api/vendor/products" : `/api/vendor/products/${product.id}`;
  const isChangeRequest = mode === "change-request";

  function buildPayload(formData: FormData) {
    const descriptionData: DescriptionData = {
      overview: normaliseOverviewLines(overviewText),
      details
    };
    return {
      descriptionData,
      payload: {
        ...Object.fromEntries(formData.entries()),
        tags: String(formData.get("tags") ?? "").split(",").map((tag) => tag.trim()).filter(Boolean),
        description_data: descriptionData,
        description: descriptionData.overview.join("\n"),
        has_variants: hasVariants,
        options: hasVariants ? options : [],
        variants: hasVariants ? variants : [],
        product_images: product?.product_images ?? pendingImages,
        pending_images: pendingImages.map((image, index) => ({
          url: image.url,
          storage_path: image.storage_path,
          alt_text: image.alt_text ?? "",
          position: index
        }))
      }
    };
  }

  async function save(formData: FormData, submit = false) {
    const { descriptionData, payload } = buildPayload(formData);
    if (isChangeRequest) {
      const reason = String(formData.get("request_reason") ?? "").trim();
      const res = await fetch("/api/vendor/product-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: product.id,
          request_type: "edit",
          reason,
          proposed_data: payload
        })
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not submit update request.");
        return;
      }
      toast.success("Update request submitted.");
      router.push(`/vendor/products/${product.id}`);
      router.refresh();
      return;
    }

    if (submit) {
      const validationError = validateForSubmit(formData, descriptionData, imageCount);
      if (validationError) {
        toast.error(validationError);
        return;
      }
    }

    const res = await fetch(endpoint, { method: mode === "create" ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? "Could not save product.");
      return;
    }
    const id = json.product?.id ?? product?.id;
    if (submit) {
      const submitRes = await fetch(`/api/vendor/products/${id}/submit`, { method: "POST" });
      const submitJson = await submitRes.json();
      if (!submitRes.ok) {
        toast.error(submitJson.error ?? "Could not submit product.");
        return;
      }
      toast.success("Product submitted to admin.");
    } else {
      toast.success("Draft saved.");
    }
    router.push(`/vendor/products/${id}`);
    router.refresh();
  }

  const basePrice = Number(product?.price ?? 0);
  const baseStock = Number(product?.stock ?? 0);

  return (
    <form ref={formRef} className="space-y-5">
      <Section title="Basic Information">
        <Field name="title" label="Title" requiredMark defaultValue={product?.title} required disabled={readOnly} />
        <Field name="product_type" label="Product type" defaultValue={product?.product_type} disabled={readOnly} />
        <Field name="category" label="Category" defaultValue={product?.category} disabled={readOnly} />
        <Field name="tags" label="Tags" defaultValue={(product?.tags ?? []).join(", ")} disabled={readOnly} />
      </Section>

      <Section title="Description">
        <div className="md:col-span-2">
          <label>
            <LabelText label="Product Overview" required />
            <textarea
              value={overviewText}
              onChange={(event) => setOverviewText(event.target.value)}
              disabled={readOnly}
              rows={5}
              className="focus-ring mt-1 w-full rounded-xl border border-line bg-white px-4 py-2 text-sm shadow-sm disabled:bg-panel"
            />
          </label>
          <p className="mt-2 text-sm text-slate-500">Add 3-6 short bullet points describing the product, key features and suitable spaces.</p>
        </div>
        <DetailsTable details={details} readOnly={readOnly} onChange={setDetails} />
      </Section>

      <Section title="Pricing & Inventory">
        <Field name="price" label="Price" requiredMark type="number" step="0.01" defaultValue={product?.price} required disabled={readOnly} />
        <Field name="compare_at_price" label="Compare at price" type="number" step="0.01" defaultValue={product?.compare_at_price} disabled={readOnly} />
        <Field name="sku" label="SKU" defaultValue={product?.sku} disabled={readOnly} />
        <Field name="barcode" label="Barcode" defaultValue={product?.barcode} disabled={readOnly} />
        <Field name="stock" label="Stock" requiredMark type="number" defaultValue={product?.stock ?? 0} required disabled={readOnly} />
      </Section>

      <Section title="Images">
        <ProductImageUploader
          productId={product?.id}
          vendorId={product?.vendor_id ?? vendorId ?? ""}
          existing={product?.id ? product.product_images ?? [] : pendingImages}
          readOnly={readOnly || isChangeRequest}
          onChange={setImageCount}
          onImagesChange={setPendingImages}
        />
        {isChangeRequest && <p className="md:col-span-2 text-sm text-slate-500">Image changes are reviewed separately in a future version. Current images are included as a snapshot.</p>}
      </Section>

      <Section title="Variants">
        <VariantEditor
          enabled={hasVariants}
          options={options}
          variants={variants}
          basePrice={basePrice}
          baseSku={product?.sku ?? ""}
          baseStock={baseStock}
          readOnly={readOnly}
          onEnabledChange={setHasVariants}
          onOptionsChange={setOptions}
          onVariantsChange={setVariants}
        />
        {!readOnly && hasVariants && (
          <div className="md:col-span-2">
            <button formAction={(fd) => save(fd)} className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold shadow-sm">
              Save variants
            </button>
          </div>
        )}
      </Section>

      <Section title="SEO">
        <Field name="seo_title" label="SEO title" defaultValue={product?.seo_title} disabled={readOnly} />
        <TextArea name="seo_description" label="SEO description" defaultValue={product?.seo_description} disabled={readOnly} />
      </Section>

      {!readOnly && (
        <>
          {isChangeRequest && (
            <Section title="Update Request">
              <TextArea name="request_reason" label="Reason for update" defaultValue="" />
            </Section>
          )}
          <div className="flex gap-3">
            {isChangeRequest ? (
              <button formAction={(fd) => save(fd)} className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm"><Send className="h-4 w-4" />Submit Update Request</button>
            ) : (
              <>
                <button formAction={(fd) => save(fd)} className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold shadow-sm"><Save className="h-4 w-4" />Save Draft</button>
                <button formAction={(fd) => save(fd, true)} className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm"><Send className="h-4 w-4" />Submit to Admin</button>
              </>
            )}
          </div>
        </>
      )}
    </form>
  );
}

function validateForSubmit(formData: FormData, descriptionData: DescriptionData, imageCount: number) {
  if (!String(formData.get("title") ?? "").trim()) return "Please complete Title before submitting.";
  if (!descriptionData.overview.length) return "Please complete Product Overview before submitting.";
  if (Number(formData.get("price") ?? 0) <= 0) return "Please complete Price before submitting.";
  if (Number(formData.get("stock") ?? -1) < 0) return "Please complete Stock before submitting.";
  if (imageCount < 1) return "Please add at least one product image.";
  const missing = ["Colour", "Material", "Assembly"].filter((label) => !descriptionData.details.find((row) => row.label === label)?.value.trim());
  if (missing.length) return "Please complete Colour, Material and Assembly in Details.";
  return null;
}

function DetailsTable({ details, readOnly, onChange }: { details: DescriptionData["details"]; readOnly?: boolean; onChange: (details: DescriptionData["details"]) => void }) {
  function update(index: number, patch: Partial<DescriptionData["details"][number]>) {
    onChange(details.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  return (
    <div className="md:col-span-2">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-medium text-ink">Details Table</h3>
        {!readOnly && (
          <button type="button" onClick={() => onChange([...details, { label: "", value: "" }])} className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold shadow-sm">
            <Plus className="h-4 w-4" /> Add detail row
          </button>
        )}
      </div>
      <div className="space-y-3">
        {details.map((row, index) => (
          <div key={`${row.label}-${index}`} className="grid gap-3 md:grid-cols-[220px_1fr_auto]">
            <label>
              <span className="text-sm font-medium text-slate-700">Label</span>
              <input value={row.label} disabled={readOnly || row.locked} onChange={(event) => update(index, { label: event.target.value })} className="focus-ring mt-1 w-full rounded-xl border border-line bg-white px-4 py-2 text-sm shadow-sm disabled:bg-panel" />
            </label>
            <label>
              <span className="text-sm font-medium text-slate-700">Value {row.locked && <span className="text-red-500">*</span>}</span>
              <input value={row.value} disabled={readOnly} onChange={(event) => update(index, { value: event.target.value })} className="focus-ring mt-1 w-full rounded-xl border border-line bg-white px-4 py-2 text-sm shadow-sm disabled:bg-panel" />
            </label>
            <div className="mt-6 flex items-center justify-center">
              {row.locked ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"><Lock className="h-3 w-3" /> Required</span>
              ) : !readOnly ? (
                <button type="button" onClick={() => onChange(details.filter((_, rowIndex) => rowIndex !== index))} className="rounded-xl border border-line bg-white p-2 shadow-sm"><Trash2 className="h-4 w-4" /></button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-line bg-white p-6 shadow-sm"><h2 className="mb-4 font-semibold">{title}</h2><div className="grid gap-4 md:grid-cols-2">{children}</div></section>;
}

function LabelText({ label, required }: { label: string; required?: boolean }) {
  return <span className="text-sm font-medium text-slate-700">{label} {required && <span className="text-red-500">*</span>}</span>;
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; requiredMark?: boolean }) {
  const { label, requiredMark, ...rest } = props;
  return <label><LabelText label={label} required={requiredMark} /><input {...rest} className="focus-ring mt-1 w-full rounded-xl border border-line bg-white px-4 py-2 text-sm shadow-sm disabled:bg-panel" /></label>;
}

function TextArea({ label, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; name: string }) {
  return <label className="md:col-span-2"><span className="text-sm font-medium text-slate-700">{label}</span><textarea {...rest} rows={4} className="focus-ring mt-1 w-full rounded-xl border border-line bg-white px-4 py-2 text-sm shadow-sm disabled:bg-panel" /></label>;
}

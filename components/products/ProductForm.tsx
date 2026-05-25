"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Lock, Plus, Save, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ProductImageDraft, ProductImageUploader } from "@/components/products/ProductImageUploader";
import { ProductOption, VariantEditor, VariantRow } from "@/components/products/VariantEditor";
import { CategorySelector } from "@/components/products/CategorySelector";
import { DescriptionData, normaliseDescriptionData, normaliseOverviewLines } from "@/lib/product-description";

export function ProductForm({ product, mode = "create", readOnly = false, vendorId }: { product?: any; mode?: "create" | "edit" | "change-request"; readOnly?: boolean; vendorId?: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const initialDescription = useMemo(() => normaliseDescriptionData(product?.description_data), [product?.description_data]);
  const initialImages = useMemo<ProductImageDraft[]>(() => product?.product_images ?? [], [product?.product_images]);
  const [overviewText, setOverviewText] = useState(initialDescription.overview.join("\n"));
  const [details, setDetails] = useState(initialDescription.details);
  const [imageCount, setImageCount] = useState(initialImages.length);
  const [productImages, setProductImages] = useState<ProductImageDraft[]>(initialImages);
  const [hasVariants, setHasVariants] = useState(Boolean(product?.has_variants));
  const [mainPrice, setMainPrice] = useState(String(product?.price ?? ""));
  const [mainCompareAtPrice, setMainCompareAtPrice] = useState(String(product?.compare_at_price ?? ""));
  const [mainStock, setMainStock] = useState(String(product?.stock ?? 0));
  const [options, setOptions] = useState<ProductOption[]>(Array.isArray(product?.options) && product.options.length ? product.options : [{ name: "Size", values: [] }]);
  const [variants, setVariants] = useState<VariantRow[]>(product?.product_variants ?? []);
  const endpoint = mode === "create" ? "/api/vendor/products" : `/api/vendor/products/${product.id}`;
  const isChangeRequest = mode === "change-request";

  function buildPayload(formData: FormData) {
    const descriptionData: DescriptionData = {
      overview: normaliseOverviewLines(overviewText),
      details
    };
    const compareAtPrice = optionalNumber(mainCompareAtPrice);
    return {
      descriptionData,
      payload: {
        ...Object.fromEntries(formData.entries()),
        price: requiredNumber(mainPrice),
        compare_at_price: compareAtPrice,
        stock: requiredNumber(mainStock),
        tags: String(formData.get("tags") ?? "").split(",").map((tag) => tag.trim()).filter(Boolean),
        description_data: descriptionData,
        description: descriptionData.overview.join("\n"),
        has_variants: hasVariants,
        options: hasVariants ? options : [],
        variants: hasVariants ? variants : [],
        product_images: productImages.map((image, index) => ({
          id: image.id,
          url: image.url,
          storage_path: image.storage_path,
          alt_text: image.alt_text ?? "",
          position: index,
          action: image.action ?? "keep"
        })),
        pending_images: productImages.map((image, index) => ({
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
      const res = await fetch("/api/vendor/product-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: product.id,
          request_type: "edit",
          reason: null,
          proposed_data: payload
        })
      });
      const json = await res.json();
      if (!res.ok) {
        console.error(json.details ?? json.error);
        toast.error(json.error ?? "Update request could not be submitted. Please contact admin.");
        return;
      }
      toast.success("Update request submitted for admin review.");
      router.push(`/vendor/products/${product.id}`);
      router.refresh();
      return;
    }

    if (submit) {
      const validationError = validateForSubmit(formData, descriptionData, imageCount, hasVariants, variants, mainPrice, mainStock);
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
        <CategorySelector defaultCategory={product?.category} defaultCategoryId={product?.category_id} defaultShopifyCategoryId={product?.shopify_category_id} disabled={readOnly} />
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
        {hasVariants && <p className="md:col-span-2 rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-800">This product uses variants. Please set price, compare-at price and stock for each variant below.</p>}
        <MoneyField name="price" label="Price" requiredMark={!hasVariants} value={mainPrice} onChange={(event) => setMainPrice(event.target.value)} required={!hasVariants} disabled={readOnly || hasVariants} />
        <MoneyField name="compare_at_price" label="Compare at price" value={mainCompareAtPrice} onChange={(event) => setMainCompareAtPrice(event.target.value)} disabled={readOnly || hasVariants} />
        <Field name="sku" label="SKU" defaultValue={product?.sku} disabled={readOnly} />
        <Field name="barcode" label="Barcode" defaultValue={product?.barcode} disabled={readOnly} />
        <Field name="stock" label="Stock" requiredMark={!hasVariants} type="number" value={mainStock} onChange={(event) => setMainStock(event.target.value)} required={!hasVariants} disabled={readOnly || hasVariants} />
      </Section>

      <Section title="Images">
        <ProductImageUploader
          productId={isChangeRequest ? undefined : product?.id}
          vendorId={product?.vendor_id ?? vendorId ?? ""}
          existing={productImages}
          readOnly={readOnly}
          staging={isChangeRequest}
          onChange={setImageCount}
          onImagesChange={setProductImages}
        />
        {isChangeRequest && <p className="md:col-span-2 text-sm text-slate-500">Image changes will be submitted for admin review and will not update Shopify until approved.</p>}
      </Section>

      <Section title="Variants">
        <VariantEditor
          enabled={hasVariants}
          options={options}
          variants={variants}
          basePrice={Number(mainPrice || basePrice || 0)}
          baseSku={product?.sku ?? ""}
          baseStock={Number(mainStock || baseStock || 0)}
          readOnly={readOnly}
          onEnabledChange={(enabled) => {
            if (!enabled && hasVariants && !window.confirm("Turning off variants will use the main product price and stock instead.")) return;
            setHasVariants(enabled);
          }}
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

function validateForSubmit(formData: FormData, descriptionData: DescriptionData, imageCount: number, hasVariants: boolean, variants: VariantRow[], mainPrice: string, mainStock: string) {
  if (!String(formData.get("title") ?? "").trim()) return "Please complete Title before submitting.";
  if (!descriptionData.overview.length) return "Please complete Product Overview before submitting.";
  if (!hasVariants && Number(mainPrice || 0) <= 0) return "Please complete Price before submitting.";
  if (!hasVariants && Number(mainStock || -1) < 0) return "Please complete Stock before submitting.";
  if (hasVariants && !variants.length) return "Please add at least one variant.";
  if (hasVariants && variants.some((variant) => variant.price === null || variant.price === undefined || Number(variant.price) <= 0)) return "Please complete price for every variant.";
  if (hasVariants && variants.some((variant) => variant.stock === null || variant.stock === undefined || Number(variant.stock) < 0)) return "Please complete stock for every variant.";
  if (imageCount < 1) return "Please add at least one product image.";
  const missing = ["Colour", "Material", "Assembly"].filter((label) => !descriptionData.details.find((row) => row.label === label)?.value.trim());
  if (missing.length) return "Please complete Colour, Material and Assembly in Details.";
  const incompleteCustomRow = descriptionData.details.find((row) => !row.locked && row.label.trim() && !row.value.trim());
  if (incompleteCustomRow) return "Please complete or remove empty detail rows.";
  return null;
}

function optionalNumber(value: FormDataEntryValue | string | null) {
  const text = String(value ?? "").trim();
  return text === "" ? null : Number(text);
}

function requiredNumber(value: FormDataEntryValue | string | null) {
  const text = String(value ?? "").trim();
  return text === "" ? 0 : Number(text);
}

function DetailsTable({ details, readOnly, onChange }: { details: DescriptionData["details"]; readOnly?: boolean; onChange: (details: DescriptionData["details"]) => void }) {
  function update(rowId: string, patch: Partial<DescriptionData["details"][number]>) {
    onChange(details.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  }

  return (
    <div className="md:col-span-2">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-medium text-ink">Details Table</h3>
        {!readOnly && (
          <button type="button" onClick={() => onChange([...details, { id: createDetailRowId(), label: "", value: "" }])} className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold shadow-sm">
            <Plus className="h-4 w-4" /> Add detail row
          </button>
        )}
      </div>
      <div className="space-y-3">
        {details.map((row) => (
          <div key={row.id} className="grid gap-3 md:grid-cols-[220px_1fr_auto]">
            <label>
              <span className="text-sm font-medium text-slate-700">Label</span>
              <input value={row.label} disabled={readOnly || row.locked} placeholder="e.g. Dimensions" onChange={(event) => update(row.id, { label: event.target.value })} className="focus-ring mt-1 w-full rounded-xl border border-line bg-white px-4 py-2 text-sm shadow-sm disabled:bg-panel" />
            </label>
            <label>
              <span className="text-sm font-medium text-slate-700">Value {row.locked && <span className="text-red-500">*</span>}</span>
              <input value={row.value} disabled={readOnly} placeholder={detailValuePlaceholder(row)} title={detailValueTitle(row)} onChange={(event) => update(row.id, { value: event.target.value })} className="focus-ring mt-1 w-full rounded-xl border border-line bg-white px-4 py-2 text-sm shadow-sm disabled:bg-panel" />
            </label>
            <div className="mt-6 flex items-center justify-center">
              {row.locked ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"><Lock className="h-3 w-3" /> Required</span>
              ) : !readOnly ? (
                <button type="button" onClick={() => onChange(details.filter((detail) => detail.id !== row.id))} className="rounded-xl border border-line bg-white p-2 shadow-sm"><Trash2 className="h-4 w-4" /></button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function createDetailRowId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function detailValuePlaceholder(row: DescriptionData["details"][number]) {
  if (row.id === "colour" || row.label === "Colour") return "e.g. Red, Black, Blue";
  if (row.id === "material" || row.label === "Material") return "e.g. Boucle, Velvet, Oak";
  if (row.id === "assembly" || row.label === "Assembly") return "e.g. No, Yes, Partial Assembly";
  return "Enter detail value";
}

function detailValueTitle(row: DescriptionData["details"][number]) {
  if (row.id === "colour" || row.label === "Colour") return "Enter the product colour or colour options.";
  if (row.id === "material" || row.label === "Material") return "Enter the main product material.";
  if (row.id === "assembly" || row.label === "Assembly") return "Enter whether assembly is required.";
  return undefined;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-line bg-white p-6 shadow-sm"><h2 className="mb-4 font-semibold">{title}</h2><div className="grid gap-4 md:grid-cols-2">{children}</div></section>;
}

function LabelText({ label, required }: { label: string; required?: boolean }) {
  return <span className="text-sm font-medium text-slate-700">{label} {required && <span className="text-red-500">*</span>}</span>;
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; requiredMark?: boolean }) {
  const { label, requiredMark, ...rest } = props;
  return <label><LabelText label={label} required={requiredMark} /><input {...rest} defaultValue={rest.defaultValue ?? ""} className="focus-ring mt-1 w-full rounded-xl border border-line bg-white px-4 py-2 text-sm shadow-sm disabled:bg-panel" /></label>;
}

function MoneyField(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; requiredMark?: boolean }) {
  const { label, requiredMark, ...rest } = props;
  return (
    <label>
      <LabelText label={label} required={requiredMark} />
      <div className="mt-1 flex overflow-hidden rounded-xl border border-line bg-white shadow-sm focus-within:ring-2 focus-within:ring-slate-900/10">
        <span className="flex items-center border-r border-line bg-panel px-3 text-sm font-semibold text-slate-500">$</span>
        <input {...rest} type="number" step={rest.step ?? "0.01"} className="w-full border-0 bg-white px-3 py-2 text-sm outline-none disabled:bg-panel" />
      </div>
    </label>
  );
}

function TextArea({ label, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; name: string }) {
  return <label className="md:col-span-2"><span className="text-sm font-medium text-slate-700">{label}</span><textarea {...rest} rows={4} className="focus-ring mt-1 w-full rounded-xl border border-line bg-white px-4 py-2 text-sm shadow-sm disabled:bg-panel" /></label>;
}

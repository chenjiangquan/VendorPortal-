"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { HelpCircle, Lock, Plus, Save, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ProductImageDraft, ProductImageUploader } from "@/components/products/ProductImageUploader";
import { ProductOption, VariantEditor, VariantRow } from "@/components/products/VariantEditor";
import { CategorySelector } from "@/components/products/CategorySelector";
import { AiProductCopyButton } from "@/components/products/AiProductCopyButton";
import { DescriptionData, normaliseDescriptionData, normaliseOverviewLines } from "@/lib/product-description";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";

export function ProductForm({ product, mode = "create", readOnly = false, vendorId }: { product?: any; mode?: "create" | "edit" | "change-request"; readOnly?: boolean; vendorId?: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const formRef = useRef<HTMLFormElement>(null);
  const initialDescription = useMemo(() => normaliseDescriptionData(product?.description_data), [product?.description_data]);
  const initialImages = useMemo<ProductImageDraft[]>(() => product?.product_images ?? [], [product?.product_images]);
  const [title, setTitle] = useState(product?.title ?? "");
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

  function buildPayload(formData: FormData, imagesForPayload = productImages) {
    const descriptionData: DescriptionData = {
      overview: normaliseOverviewLines(overviewText),
      details
    };
    const compareAtPrice = optionalNumber(mainCompareAtPrice);
    const mainProductPrice = hasVariants ? null : requiredNumber(mainPrice);
    const mainProductStock = hasVariants ? null : requiredNumber(mainStock);
    return {
      descriptionData,
      payload: {
        ...Object.fromEntries(formData.entries()),
        price: mainProductPrice,
        compare_at_price: hasVariants ? null : compareAtPrice,
        stock: mainProductStock,
        tags: String(formData.get("tags") ?? "").split(",").map((tag) => tag.trim()).filter(Boolean),
        description_data: descriptionData,
        description: descriptionData.overview.join("\n"),
        has_variants: hasVariants,
        options: hasVariants ? options : [],
        variants: hasVariants ? variants : [],
        product_images: imagesForPayload.map((image, index) => ({
          id: image.id,
          url: image.url,
          storage_path: image.storage_path ?? "",
          alt_text: image.alt_text ?? "",
          position: index,
          action: image.action ?? "keep"
        })),
        pending_images: imagesForPayload.flatMap((image, index) => image.action === "add" ? [{
          url: image.url,
          storage_path: image.storage_path ?? "",
          alt_text: image.alt_text ?? "",
          position: index
        }] : [])
      }
    };
  }

  async function save(formData: FormData, submit = false) {
    const compareAtPriceError = validateCompareAtPrice(hasVariants, mainPrice, mainCompareAtPrice, variants);
    if (compareAtPriceError) {
      toast.error(compareAtPriceError);
      return;
    }

    let imagesForPayload = productImages;
    let uploadedTemporaryPaths: string[] = [];
    try {
      const materialized = await materializeTemporaryImages(productImages, vendorId ?? product?.vendor_id ?? "", product?.id);
      imagesForPayload = materialized.images;
      uploadedTemporaryPaths = materialized.uploadedStoragePaths;
      if (imagesForPayload !== productImages) {
        setProductImages(imagesForPayload);
        setImageCount(imagesForPayload.length);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save AI generated images.");
      return;
    }

    const { descriptionData, payload } = buildPayload(formData, imagesForPayload);
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
      const json = await readApiJson(res);
      if (!res.ok) {
        console.error(json.details ?? json.error);
        await cleanupUploadedTemporaryImages(uploadedTemporaryPaths);
        setProductImages(productImages);
        setImageCount(productImages.length);
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

    if (submit && mode !== "create") {
      const submitRes = await fetch(`/api/vendor/products/${product.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const submitJson = await readApiJson(submitRes);
      if (!submitRes.ok) {
        console.error(submitJson.details ?? submitJson.error);
        await cleanupUploadedTemporaryImages(uploadedTemporaryPaths);
        setProductImages(productImages);
        setImageCount(productImages.length);
        toast.error(submitJson.error ?? "Could not submit product.");
        return;
      }
      toast.success("Product submitted to admin.");
      router.push(`/vendor/products/${product.id}`);
      router.refresh();
      return;
    }

    const res = await fetch(endpoint, { method: mode === "create" ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const json = await readApiJson(res);
    if (!res.ok) {
      console.error(json.details ?? json.error);
      await cleanupUploadedTemporaryImages(uploadedTemporaryPaths);
      setProductImages(productImages);
      setImageCount(productImages.length);
      toast.error(json.error ?? "Could not save product.");
      return;
    }
    const id = json.product?.id ?? product?.id;
    if (submit) {
      const submitRes = await fetch(`/api/vendor/products/${id}/submit`, { method: "POST" });
      const submitJson = await readApiJson(submitRes);
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

  async function deleteProduct() {
    const confirmed = window.confirm(product?.id ? "Delete this product?" : "Discard this product?");
    if (!confirmed) return;

    if (!product?.id) {
      await cleanupUploadedTemporaryImages(productImages.flatMap((image) => image.storage_path && !image.is_temporary ? [image.storage_path] : []));
      toast.success("Product discarded.");
      router.push("/vendor/products");
      return;
    }

    const res = await fetch("/api/vendor/products/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productIds: [product.id] })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(json.error ?? "Product could not be deleted.");
      return;
    }

    toast.success(json.requestCount ? "Delete request submitted." : "Product deleted.");
    router.push("/vendor/products");
    router.refresh();
  }

  const basePrice = Number(product?.price ?? 0);
  const baseStock = Number(product?.stock ?? 0);

  return (
    <form ref={formRef} className="space-y-5">
      <Section title={t("product.basicInfo")}>
        <div className="md:col-span-2">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
            <LabelText label={t("product.title")} required />
            <AiProductCopyButton
              images={productImages}
              title={title}
              overviewText={overviewText}
              details={details}
              target="title"
              formRef={formRef}
              readOnly={readOnly}
              onApply={(result) => {
                if (result.title) setTitle(result.title);
                if (result.overviewText) setOverviewText(result.overviewText);
              }}
            />
          </div>
          <input
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            disabled={readOnly}
            className="focus-ring w-full rounded-xl border border-line bg-white px-4 py-2 text-sm shadow-sm disabled:bg-panel"
          />
        </div>
        <CategorySelector defaultCategory={product?.category} defaultCategoryId={product?.category_id} defaultShopifyCategoryId={product?.shopify_category_id} disabled={readOnly} />
      </Section>

      <Section title={t("product.description")}>
        <div className="md:col-span-2">
          <label>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
              <LabelText label={t("product.productOverview")} required />
              <AiProductCopyButton
                images={productImages}
                title={title}
                overviewText={overviewText}
                details={details}
                target="overview"
                formRef={formRef}
                readOnly={readOnly}
                onApply={(result) => {
                  if (result.title) setTitle(result.title);
                  if (result.overviewText) setOverviewText(result.overviewText);
                }}
              />
            </div>
            <textarea
              value={overviewText}
              onChange={(event) => setOverviewText(event.target.value)}
              disabled={readOnly}
              rows={5}
              className="focus-ring mt-1 w-full rounded-xl border border-line bg-white px-4 py-2 text-sm shadow-sm disabled:bg-panel"
            />
          </label>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <p className="text-sm text-slate-500">{t("product.overviewHelp")}</p>
          </div>
        </div>
        <DetailsTable details={details} readOnly={readOnly} onChange={setDetails} />
      </Section>

      <Section title={t("product.pricingInventory")}>
        {hasVariants && <p className="md:col-span-2 rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-800">{t("product.variantPriceNotice")}</p>}
        <MoneyField name="price" label={t("product.price")} requiredMark={!hasVariants} value={mainPrice} placeholder={hasVariants ? "Set prices in variants below" : undefined} onChange={(event) => setMainPrice(event.target.value)} required={!hasVariants} disabled={readOnly || hasVariants} />
        <MoneyField name="compare_at_price" label={t("product.compareAtPrice")} help={<CompareAtPriceHelp />} value={mainCompareAtPrice} placeholder={hasVariants ? "Set compare-at prices in variants below" : undefined} onChange={(event) => setMainCompareAtPrice(event.target.value)} disabled={readOnly || hasVariants} />
        <Field name="sku" label={t("product.sku")} defaultValue={product?.sku} disabled={readOnly} />
        <Field name="stock" label={t("product.stock")} requiredMark={!hasVariants} type="number" value={mainStock} placeholder={hasVariants ? "Set stock in variants below" : undefined} onChange={(event) => setMainStock(event.target.value)} required={!hasVariants} disabled={readOnly || hasVariants} />
      </Section>

      <Section title={t("product.images")}>
        <ProductImageUploader
          productId={isChangeRequest ? undefined : product?.id}
          vendorId={product?.vendor_id ?? vendorId ?? ""}
          existing={productImages}
          readOnly={readOnly}
          staging={isChangeRequest}
          onChange={setImageCount}
          onImagesChange={setProductImages}
          aiTitle={title}
        />
        {isChangeRequest && <p className="md:col-span-2 text-sm text-slate-500">Image changes will be submitted for admin review and will not update Shopify until approved.</p>}
      </Section>

      <Section title={t("product.variants")}>
        <VariantEditor
          enabled={hasVariants}
          options={options}
          variants={variants}
          basePrice={Number(mainPrice || basePrice || 0)}
          baseSku={product?.sku ?? ""}
          baseStock={Number(mainStock || baseStock || 0)}
          readOnly={readOnly}
          onEnabledChange={(enabled) => {
            if (enabled) {
              setMainPrice("0");
              setMainCompareAtPrice("");
              setMainStock("0");
            }
            setHasVariants(enabled);
          }}
          onOptionsChange={setOptions}
          onVariantsChange={setVariants}
        />
        {!readOnly && hasVariants && (
          <div className="md:col-span-2">
            <button formAction={(fd) => save(fd)} className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold shadow-sm">
              {t("product.saveVariants")}
            </button>
          </div>
        )}
      </Section>

      {!readOnly && (
        <>
          <div className="flex gap-3">
            {isChangeRequest ? (
              <button formAction={(fd) => save(fd)} className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm"><Send className="h-4 w-4" />{t("product.submitUpdateRequest")}</button>
            ) : (
              <>
                <button formAction={(fd) => save(fd)} className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold shadow-sm"><Save className="h-4 w-4" />{t("product.saveDraft")}</button>
                <button formAction={(fd) => save(fd, true)} className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm"><Send className="h-4 w-4" />{t("product.submitToAdmin")}</button>
                <button type="button" onClick={deleteProduct} className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-100"><Trash2 className="h-4 w-4" />{t("product.deleteProduct")}</button>
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
  if (hasVariants && variants.some((variant) => variant.price === null || variant.price === undefined || Number(variant.price) <= 0)) return "Please complete price for all variants before submitting.";
  if (hasVariants && variants.some((variant) => variant.stock === null || variant.stock === undefined || Number(variant.stock) < 0)) return "Please complete stock for all variants before submitting.";
  if (imageCount < 1) return "Please add at least one product image.";
  const missing = ["Colour", "Material", "Assembly"].filter((label) => !descriptionData.details.find((row) => row.label === label)?.value.trim());
  if (missing.length) return "Please complete Colour, Material and Assembly in Details.";
  const incompleteCustomRow = descriptionData.details.find((row) => !row.locked && row.label.trim() && !row.value.trim());
  if (incompleteCustomRow) return "Please complete or remove empty detail rows.";
  return null;
}

function validateCompareAtPrice(hasVariants: boolean, mainPrice: string, mainCompareAtPrice: string, variants: VariantRow[]) {
  if (hasVariants) {
    const invalidVariant = variants.find((variant) => {
      const compareAtPrice = Number(variant.compare_at_price ?? 0);
      if (!compareAtPrice) return false;
      const price = Number(variant.price ?? 0);
      return !price || compareAtPrice <= price;
    });
    return invalidVariant ? "Compare at price must be higher than price." : null;
  }

  const compareAtPrice = optionalNumber(mainCompareAtPrice);
  if (compareAtPrice === null) return null;
  const price = requiredNumber(mainPrice);
  return !price || compareAtPrice <= price ? "Compare at price must be higher than price." : null;
}

function optionalNumber(value: FormDataEntryValue | string | null) {
  const text = String(value ?? "").trim();
  return text === "" ? null : Number(text);
}

function requiredNumber(value: FormDataEntryValue | string | null) {
  const text = String(value ?? "").trim();
  return text === "" ? 0 : Number(text);
}

async function materializeTemporaryImages(images: ProductImageDraft[], vendorId: string, productId?: string) {
  const temporaryImages = images.filter((image) => image.is_temporary);
  if (!temporaryImages.length) return { images, uploadedStoragePaths: [] };
  if (!vendorId) throw new Error("Could not save AI images because vendor details are missing.");

  const supabase = createClient();
  const materialized: ProductImageDraft[] = [];
  const uploadedStoragePaths: string[] = [];

  for (const image of images) {
    if (!image.is_temporary) {
      materialized.push(image);
      continue;
    }

    const blob = await dataUrlToBlob(image.url);
    const storagePath = `${vendorId}/${productId ?? "pending"}/${crypto.randomUUID()}-ai-generated.png`;
    const { error } = await supabase.storage.from("product-images").upload(storagePath, blob, {
      contentType: blob.type || "image/png",
      upsert: false
    });
    if (error) throw new Error(error.message);
    uploadedStoragePaths.push(storagePath);

    const { data } = supabase.storage.from("product-images").getPublicUrl(storagePath);
    materialized.push({
      ...image,
      url: data.publicUrl,
      storage_path: storagePath,
      is_temporary: false,
      action: "add"
    });
  }

  return { images: materialized, uploadedStoragePaths };
}

async function cleanupUploadedTemporaryImages(paths: string[]) {
  if (!paths.length) return;
  await createClient().storage.from("product-images").remove(paths);
}

async function readApiJson(response: Response) {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {
      error: response.ok ? "The server returned an invalid response." : `Request failed with status ${response.status}.`
    };
  }
}

async function dataUrlToBlob(dataUrl: string) {
  if (!dataUrl.startsWith("data:image/")) throw new Error("AI image preview is invalid.");
  const response = await fetch(dataUrl);
  if (!response.ok) throw new Error("Could not prepare AI image for upload.");
  return response.blob();
}

function DetailsTable({ details, readOnly, onChange }: { details: DescriptionData["details"]; readOnly?: boolean; onChange: (details: DescriptionData["details"]) => void }) {
  const { t } = useI18n();
  function update(rowId: string, patch: Partial<DescriptionData["details"][number]>) {
    onChange(details.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  }

  return (
    <div className="md:col-span-2">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-medium text-ink">{t("product.detailsTable")}</h3>
        {!readOnly && (
          <button type="button" onClick={() => onChange([...details, { id: createDetailRowId(), label: "", value: "" }])} className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold shadow-sm">
            <Plus className="h-4 w-4" /> {t("product.addDetailRow")}
          </button>
        )}
      </div>
      <div className="space-y-3">
        {details.map((row) => (
          <div key={row.id} className="grid gap-3 md:grid-cols-[220px_1fr_auto]">
            <label>
              <span className="text-sm font-medium text-slate-700">{t("product.label")}</span>
              <input value={row.label} disabled={readOnly || row.locked} placeholder="e.g. Dimensions" onChange={(event) => update(row.id, { label: event.target.value })} className="focus-ring mt-1 w-full rounded-xl border border-line bg-white px-4 py-2 text-sm shadow-sm disabled:bg-panel" />
            </label>
            <label>
              <span className="text-sm font-medium text-slate-700">{t("product.value")} {row.locked && <span className="text-red-500">*</span>}</span>
              <input value={row.value} disabled={readOnly} placeholder={detailValuePlaceholder(row)} title={detailValueTitle(row)} onChange={(event) => update(row.id, { value: event.target.value })} className="focus-ring mt-1 w-full rounded-xl border border-line bg-white px-4 py-2 text-sm shadow-sm disabled:bg-panel" />
            </label>
            <div className="mt-6 flex items-center justify-center">
              {row.locked ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"><Lock className="h-3 w-3" /> {t("product.required")}</span>
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
  const inputProps = "value" in rest ? rest : { ...rest, defaultValue: rest.defaultValue ?? "" };
  return <label><LabelText label={label} required={requiredMark} /><input {...inputProps} className="focus-ring mt-1 w-full rounded-xl border border-line bg-white px-4 py-2 text-sm shadow-sm disabled:bg-panel" /></label>;
}

function MoneyField(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; requiredMark?: boolean; help?: React.ReactNode }) {
  const { label, requiredMark, help, ...rest } = props;
  return (
    <label>
      <span className="flex items-center gap-1">
        <LabelText label={label} required={requiredMark} />
        {help}
      </span>
      <div className="mt-1 flex overflow-hidden rounded-xl border border-line bg-white shadow-sm focus-within:ring-2 focus-within:ring-slate-900/10">
        <span className="flex items-center border-r border-line bg-panel px-3 text-sm font-semibold text-slate-500">$</span>
        <input {...rest} type="number" step={rest.step ?? "0.01"} className="w-full border-0 bg-white px-3 py-2 text-sm outline-none disabled:bg-panel" />
      </div>
    </label>
  );
}

function CompareAtPriceHelp() {
  const { t } = useI18n();
  return (
    <span className="group relative inline-flex">
      <HelpCircle className="h-4 w-4 cursor-help text-slate-400" />
      <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-72 -translate-x-1/2 rounded-xl border border-line bg-ink px-3 py-2 text-xs font-medium text-white shadow-xl group-hover:block group-focus-within:block">
        {t("product.compareAtPriceHelp")}
      </span>
    </span>
  );
}

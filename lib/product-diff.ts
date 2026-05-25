import { normaliseDescriptionData } from "@/lib/product-description";
import { formatCurrency } from "@/lib/utils";

export type ProductFieldDiff = {
  field: string;
  label: string;
  before: string;
  after: string;
  changed: boolean;
};

export type ProductCollectionDiff = {
  label: string;
  before: string;
  after: string;
  change: "added" | "removed" | "changed";
};

export type ProductChangeDiff = {
  fields: ProductFieldDiff[];
  details: ProductCollectionDiff[];
  variants: ProductCollectionDiff[];
  images: ProductCollectionDiff[];
};

const simpleFields = [
  ["title", "Title"],
  ["product_type", "Product type"],
  ["category", "Category"],
  ["tags", "Tags"],
  ["price", "Price"],
  ["compare_at_price", "Compare at price"],
  ["sku", "SKU"],
  ["barcode", "Barcode"],
  ["stock", "Stock"],
  ["seo_title", "SEO title"],
  ["seo_description", "SEO description"],
  ["google_product_category", "Google product category"]
] as const;

export function getProductChangeDiff(currentProduct: Record<string, any>, proposedData: Record<string, any>): ProductChangeDiff {
  return {
    fields: simpleFields.map(([field, label]) => {
      const before = formatFieldValue(field, currentProduct?.[field]);
      const after = formatFieldValue(field, proposedData?.[field]);
      return { field, label, before, after, changed: before !== after };
    }),
    details: diffDetails(currentProduct?.description_data, proposedData?.description_data),
    variants: diffVariants(currentProduct?.product_variants ?? [], proposedData?.variants ?? proposedData?.product_variants ?? []),
    images: diffImages(currentProduct?.product_images ?? [], proposedData?.product_images ?? proposedData?.images ?? [])
  };
}

function formatFieldValue(field: string, value: unknown) {
  if (field === "price" || field === "compare_at_price") return value === null || value === undefined || value === "" ? "-" : formatCurrency(value as number | string);
  if (field === "tags") return Array.isArray(value) ? value.join(", ") || "-" : String(value || "-");
  return value === null || value === undefined || value === "" ? "-" : String(value);
}

function diffDetails(currentValue: unknown, proposedValue: unknown): ProductCollectionDiff[] {
  const current = normaliseDescriptionData(currentValue).details.filter((row) => row.label || row.value);
  const proposed = normaliseDescriptionData(proposedValue).details.filter((row) => row.label || row.value);
  const keys = new Set([...current.map(detailKey), ...proposed.map(detailKey)]);

  const rows: ProductCollectionDiff[] = [];
  for (const key of keys) {
    const before = current.find((row) => detailKey(row) === key);
    const after = proposed.find((row) => detailKey(row) === key);
    if (!before && after) rows.push({ label: `Added detail row: ${after.label || "Untitled"}`, before: "-", after: detailText(after), change: "added" });
    if (before && !after) rows.push({ label: `Removed detail row: ${before.label || "Untitled"}`, before: detailText(before), after: "-", change: "removed" });
    if (before && after && (before.label !== after.label || before.value !== after.value)) {
      rows.push({ label: `Changed detail row: ${after.label || before.label || "Untitled"}`, before: detailText(before), after: detailText(after), change: "changed" });
    }
  }
  return rows;
}

function detailKey(row: { id?: string; label?: string }) {
  return row.id || row.label || "";
}

function detailText(row: { label?: string; value?: string }) {
  return `${row.label || "-"}: ${row.value || "-"}`;
}

function diffVariants(current: Record<string, any>[], proposed: Record<string, any>[]): ProductCollectionDiff[] {
  const before = current.map(variantText);
  const after = proposed.map(variantText);
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  return [{ label: "Variants", before: before.join("\n") || "-", after: after.join("\n") || "-", change: before.length && after.length ? "changed" : before.length ? "removed" : "added" }];
}

function variantText(variant: Record<string, any>) {
  const options = [variant.option1_value, variant.option2_value, variant.option3_value].filter(Boolean).join(" / ") || "Default";
  return `${options} · ${formatCurrency(variant.price)} · SKU ${variant.sku || "-"} · Stock ${variant.stock ?? "-"}`;
}

function diffImages(current: Record<string, any>[], proposed: Record<string, any>[]): ProductCollectionDiff[] {
  const before = [...current].sort(sortByPosition).map(imageText);
  const after = [...proposed].filter((image) => image.action !== "remove").sort(sortByPosition).map(imageText);
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  return [{ label: "Images / order / alt text", before: before.join("\n") || "-", after: after.join("\n") || "-", change: before.length && after.length ? "changed" : before.length ? "removed" : "added" }];
}

function imageText(image: Record<string, any>, index: number) {
  return `#${index + 1} · ${image.alt_text || "No alt text"} · ${image.url || "-"}`;
}

function sortByPosition(a: Record<string, any>, b: Record<string, any>) {
  return Number(a.position ?? 0) - Number(b.position ?? 0);
}

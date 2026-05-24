"use client";

import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export type ProductOption = {
  name: string;
  values: string[];
};

export type VariantRow = {
  option1_name?: string | null;
  option1_value?: string | null;
  option2_name?: string | null;
  option2_value?: string | null;
  option3_name?: string | null;
  option3_value?: string | null;
  sku?: string | null;
  barcode?: string | null;
  price?: number | null;
  compare_at_price?: number | null;
  stock?: number | null;
};

export function VariantEditor({
  enabled,
  options,
  variants,
  basePrice,
  baseSku,
  baseStock,
  readOnly,
  onEnabledChange,
  onOptionsChange,
  onVariantsChange
}: {
  enabled: boolean;
  options: ProductOption[];
  variants: VariantRow[];
  basePrice: number;
  baseSku: string;
  baseStock: number;
  readOnly?: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onOptionsChange: (options: ProductOption[]) => void;
  onVariantsChange: (variants: VariantRow[]) => void;
}) {
  function updateOption(index: number, patch: Partial<ProductOption>) {
    onOptionsChange(options.map((option, optionIndex) => (optionIndex === index ? { ...option, ...patch } : option)));
  }

  function regenerate() {
    const cleanOptions = options
      .map((option) => ({ name: option.name.trim(), values: option.values.map((value) => value.trim()).filter(Boolean) }))
      .filter((option) => option.name && option.values.length);
    if (!cleanOptions.length) {
      toast.error("Add at least one option with values.");
      return;
    }
    const combinations = cartesian(cleanOptions.map((option) => option.values));
    const nextVariants = combinations.map((values) => {
      const title = values.join(" / ");
      const existing = variants.find((variant) => [variant.option1_value, variant.option2_value, variant.option3_value].filter(Boolean).join(" / ") === title);
      return {
        option1_name: cleanOptions[0]?.name ?? null,
        option1_value: values[0] ?? null,
        option2_name: cleanOptions[1]?.name ?? null,
        option2_value: values[1] ?? null,
        option3_name: cleanOptions[2]?.name ?? null,
        option3_value: values[2] ?? null,
        price: existing?.price ?? basePrice,
        compare_at_price: existing?.compare_at_price ?? null,
        sku: existing?.sku ?? baseSku,
        stock: existing?.stock ?? baseStock,
        barcode: existing?.barcode ?? null
      };
    });
    onOptionsChange(cleanOptions);
    onVariantsChange(nextVariants);
    toast.success("Variants regenerated.");
  }

  return (
    <div className="md:col-span-2 space-y-5">
      <label className="flex items-center gap-3 rounded-xl border border-line bg-panel p-4 text-sm font-medium">
        <input type="checkbox" checked={enabled} disabled={readOnly} onChange={(event) => onEnabledChange(event.target.checked)} />
        This product has options, like size or colour
      </label>

      {!enabled ? (
        <div className="rounded-xl border border-dashed border-line p-4 text-sm text-slate-500">
          Default variant will use the product price, SKU and stock.
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {options.map((option, index) => (
              <div key={index} className="rounded-xl border border-line bg-white p-4">
                <div className="grid gap-3 md:grid-cols-[220px_1fr_auto]">
                  <label>
                    <span className="text-sm font-medium text-slate-700">Option {index + 1} name</span>
                    <input disabled={readOnly} value={option.name} onChange={(event) => updateOption(index, { name: event.target.value })} placeholder="Size" className="focus-ring mt-1 w-full rounded-xl border border-line px-4 py-2 text-sm shadow-sm" />
                  </label>
                  <label>
                    <span className="text-sm font-medium text-slate-700">Values</span>
                    <input disabled={readOnly} value={option.values.join(", ")} onChange={(event) => updateOption(index, { values: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} placeholder="100cm, 120cm, 142cm" className="focus-ring mt-1 w-full rounded-xl border border-line px-4 py-2 text-sm shadow-sm" />
                  </label>
                  {!readOnly && options.length > 1 && (
                    <button type="button" onClick={() => onOptionsChange(options.filter((_, optionIndex) => optionIndex !== index))} className="mt-6 inline-flex items-center justify-center rounded-xl border border-line px-3 py-2 text-sm shadow-sm">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {option.values.map((value) => <span key={value} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{value}</span>)}
                </div>
              </div>
            ))}
          </div>

          {!readOnly && (
            <div className="flex flex-wrap gap-3">
              <button type="button" disabled={options.length >= 3} onClick={() => onOptionsChange([...options, { name: "", values: [] }])} className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold shadow-sm disabled:opacity-50">
                <Plus className="h-4 w-4" /> Add option
              </button>
              <button type="button" onClick={regenerate} className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm">
                Regenerate variants
              </button>
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-panel text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-3">Variant</th>
                  <th className="px-3 py-3">Price</th>
                  <th className="px-3 py-3">Compare</th>
                  <th className="px-3 py-3">SKU</th>
                  <th className="px-3 py-3">Stock</th>
                  <th className="px-3 py-3">Barcode</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {variants.map((variant, index) => (
                  <tr key={index}>
                    <td className="px-3 py-3 font-medium">{[variant.option1_value, variant.option2_value, variant.option3_value].filter(Boolean).join(" / ")}</td>
                    <td className="px-3 py-3"><CellInput type="number" value={variant.price ?? ""} readOnly={readOnly} onChange={(value) => updateVariant(variants, index, { price: Number(value) }, onVariantsChange)} /></td>
                    <td className="px-3 py-3"><CellInput type="number" value={variant.compare_at_price ?? ""} readOnly={readOnly} onChange={(value) => updateVariant(variants, index, { compare_at_price: value ? Number(value) : null }, onVariantsChange)} /></td>
                    <td className="px-3 py-3"><CellInput value={variant.sku ?? ""} readOnly={readOnly} onChange={(value) => updateVariant(variants, index, { sku: value }, onVariantsChange)} /></td>
                    <td className="px-3 py-3"><CellInput type="number" value={variant.stock ?? 0} readOnly={readOnly} onChange={(value) => updateVariant(variants, index, { stock: Number(value) }, onVariantsChange)} /></td>
                    <td className="px-3 py-3"><CellInput value={variant.barcode ?? ""} readOnly={readOnly} onChange={(value) => updateVariant(variants, index, { barcode: value }, onVariantsChange)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function CellInput({ value, onChange, type = "text", readOnly }: { value: string | number; onChange: (value: string) => void; type?: string; readOnly?: boolean }) {
  return <input type={type} disabled={readOnly} value={value} onChange={(event) => onChange(event.target.value)} className="focus-ring w-full rounded-lg border border-line px-2 py-1 text-sm disabled:bg-panel" />;
}

function updateVariant(variants: VariantRow[], index: number, patch: Partial<VariantRow>, onChange: (variants: VariantRow[]) => void) {
  onChange(variants.map((variant, variantIndex) => (variantIndex === index ? { ...variant, ...patch } : variant)));
}

function cartesian(values: string[][]) {
  return values.reduce<string[][]>((acc, current) => acc.flatMap((items) => current.map((value) => [...items, value])), [[]]);
}

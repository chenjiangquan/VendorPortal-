"use client";

import { GripVertical, HelpCircle, Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

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

export function parseOptionValues(input: string): string[] {
  const seen = new Set<string>();
  return input
    .split(/[,，;；\n]+/)
    .map((value) => value.trim())
    .filter((value) => {
      if (!value || seen.has(value)) {
        return false;
      }
      seen.add(value);
      return true;
    });
}

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
  const { t } = useI18n();

  function applyOptionsChange(nextOptions: ProductOption[]) {
    onOptionsChange(nextOptions);
    onVariantsChange(buildVariantsFromOptions(nextOptions, variants, basePrice, baseSku, baseStock));
  }

  function updateOption(index: number, patch: Partial<ProductOption>) {
    applyOptionsChange(options.map((option, optionIndex) => (optionIndex === index ? { ...option, ...patch } : option)));
  }

  function updateOptionValue(optionIndex: number, valueIndex: number, rawValue: string) {
    const currentValues = options[optionIndex]?.values ?? [];
    const parsedValues = parseOptionValues(rawValue);
    const nextValues = [...currentValues];

    if (parsedValues.length > 1) {
      if (valueIndex >= nextValues.length) {
        nextValues.push(...parsedValues);
      } else {
        nextValues.splice(valueIndex, 1, ...parsedValues);
      }
    } else if (valueIndex >= nextValues.length) {
      if (rawValue.trim()) {
        nextValues.push(rawValue.trim());
      }
    } else if (rawValue.trim()) {
      nextValues[valueIndex] = rawValue.trim();
    } else {
      nextValues.splice(valueIndex, 1);
    }

    updateOption(optionIndex, { values: uniqueValues(nextValues) });
  }

  function removeOptionValue(optionIndex: number, valueIndex: number) {
    updateOption(optionIndex, { values: options[optionIndex].values.filter((_, index) => index !== valueIndex) });
  }

  return (
    <div className="md:col-span-2 space-y-5">
      <label className="flex items-center gap-3 rounded-xl border border-line bg-panel p-4 text-sm font-medium">
        <input type="checkbox" checked={enabled} disabled={readOnly} onChange={(event) => onEnabledChange(event.target.checked)} />
        {t("product.hasOptions")}
      </label>

      {!enabled ? (
        <div className="rounded-xl border border-dashed border-line p-4 text-sm text-slate-500">
          {t("product.defaultVariantNotice")}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {options.map((option, index) => (
              <div key={index} className="rounded-xl border border-line bg-white p-4">
                <div className="grid gap-4 md:grid-cols-[220px_1fr_auto]">
                  <label>
                    <span className="text-sm font-medium text-slate-700">{t("product.optionName").replace("{index}", String(index + 1))}</span>
                    <input disabled={readOnly} value={option.name} onChange={(event) => updateOption(index, { name: event.target.value })} placeholder={t("product.optionNamePlaceholder")} className="focus-ring mt-1 w-full rounded-xl border border-line px-4 py-2 text-sm shadow-sm" />
                  </label>
                  <div>
                    <span className="text-sm font-medium text-slate-700">{t("product.optionValues")}</span>
                    <div className="mt-1 space-y-2">
                      {[...option.values, ""].map((value, valueIndex) => {
                        const isNewValueRow = valueIndex >= option.values.length;
                        return (
                          <div key={`option-value-${valueIndex}`} className="grid grid-cols-[20px_1fr_34px] items-center gap-2">
                            <GripVertical className="h-4 w-4 text-slate-400" />
                            <input
                              disabled={readOnly}
                              value={value}
                              onChange={(event) => updateOptionValue(index, valueIndex, event.target.value)}
                              placeholder={isNewValueRow ? t("product.addAnotherValue") : t("product.optionValuePlaceholder")}
                              className="focus-ring w-full rounded-xl border border-line px-4 py-2 text-sm shadow-sm"
                            />
                            {!readOnly && !isNewValueRow ? (
                              <button type="button" aria-label={`Remove ${value}`} onClick={() => removeOptionValue(index, valueIndex)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-slate-500 hover:bg-red-50 hover:text-red-600">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            ) : (
                              <span aria-hidden className="h-9 w-9" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {!readOnly && options.length > 1 && (
                    <button type="button" onClick={() => applyOptionsChange(options.filter((_, optionIndex) => optionIndex !== index))} className="mt-6 inline-flex items-center justify-center rounded-xl border border-line px-3 py-2 text-sm shadow-sm">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {!readOnly && (
            <div className="flex flex-wrap gap-3">
              <button type="button" disabled={options.length >= 3} onClick={() => applyOptionsChange([...options, { name: "", values: [] }])} className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold shadow-sm disabled:opacity-50">
                <Plus className="h-4 w-4" /> {t("product.addOption")}
              </button>
            </div>
          )}

          {variants.length ? (
            <div className="overflow-hidden rounded-xl border border-line">
              <table className="w-full text-left text-sm">
                <thead className="bg-panel text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-3">{t("product.variant")}</th>
                    <th className="px-3 py-3">{t("product.price")}</th>
                    <th className="px-3 py-3">
                      <span className="inline-flex items-center gap-1">
                        {t("product.compare")}
                        <CompareAtPriceHelp />
                      </span>
                    </th>
                    <th className="px-3 py-3">SKU</th>
                    <th className="px-3 py-3">{t("product.stock")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {variants.map((variant, index) => (
                    <tr key={index}>
                      <td className="px-3 py-3 font-medium">{[variant.option1_value, variant.option2_value, variant.option3_value].filter(Boolean).join(" / ")}</td>
                      <td className="px-3 py-3"><MoneyCellInput value={variant.price ?? ""} readOnly={readOnly} onChange={(value) => updateVariant(variants, index, { price: Number(value) }, onVariantsChange)} /></td>
                      <td className="px-3 py-3"><MoneyCellInput value={variant.compare_at_price ?? ""} readOnly={readOnly} onChange={(value) => updateVariant(variants, index, { compare_at_price: value ? Number(value) : null }, onVariantsChange)} /></td>
                      <td className="px-3 py-3"><CellInput value={variant.sku ?? ""} readOnly={readOnly} onChange={(value) => updateVariant(variants, index, { sku: value }, onVariantsChange)} /></td>
                      <td className="px-3 py-3"><CellInput type="number" value={variant.stock ?? 0} readOnly={readOnly} onChange={(value) => updateVariant(variants, index, { stock: Number(value) }, onVariantsChange)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-line bg-panel p-4 text-sm text-slate-500">
              {t("product.noVariantsYet")}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CellInput({ value, onChange, type = "text", readOnly }: { value: string | number; onChange: (value: string) => void; type?: string; readOnly?: boolean }) {
  return <input type={type} disabled={readOnly} value={value} onChange={(event) => onChange(event.target.value)} className="focus-ring w-full rounded-lg border border-line px-2 py-1 text-sm disabled:bg-panel" />;
}

function MoneyCellInput({ value, onChange, readOnly }: { value: string | number; onChange: (value: string) => void; readOnly?: boolean }) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-line bg-white focus-within:ring-2 focus-within:ring-slate-900/10">
      <span className="flex items-center border-r border-line bg-panel px-2 text-xs font-semibold text-slate-500">$</span>
      <input type="number" disabled={readOnly} value={value} onChange={(event) => onChange(event.target.value)} className="w-full border-0 px-2 py-1 text-sm outline-none disabled:bg-panel" />
    </div>
  );
}

function CompareAtPriceHelp() {
  const { t } = useI18n();
  return (
    <span className="group relative inline-flex">
      <HelpCircle className="h-4 w-4 cursor-help text-slate-400" />
      <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-72 -translate-x-1/2 rounded-xl border border-line bg-ink px-3 py-2 text-xs font-medium normal-case text-white shadow-xl group-hover:block group-focus-within:block">
        {t("product.compareAtPriceHelp")}
      </span>
    </span>
  );
}

function updateVariant(variants: VariantRow[], index: number, patch: Partial<VariantRow>, onChange: (variants: VariantRow[]) => void) {
  onChange(variants.map((variant, variantIndex) => (variantIndex === index ? { ...variant, ...patch } : variant)));
}

function buildVariantsFromOptions(options: ProductOption[], existingVariants: VariantRow[], basePrice: number, baseSku: string, baseStock: number) {
  const cleanOptions = options
    .map((option) => ({ name: option.name.trim(), values: parseOptionValues(option.values.join("\n")) }))
    .filter((option) => option.name && option.values.length);

  if (!cleanOptions.length) return [];

  return cartesian(cleanOptions.map((option) => option.values)).map((values) => {
    const title = values.join(" / ");
    const existing = existingVariants.find((variant) => getVariantTitle(variant) === title);
    return {
      option1_name: cleanOptions[0]?.name ?? null,
      option1_value: values[0] ?? null,
      option2_name: cleanOptions[1]?.name ?? null,
      option2_value: values[1] ?? null,
      option3_name: cleanOptions[2]?.name ?? null,
      option3_value: values[2] ?? null,
      price: existing?.price ?? (basePrice > 0 ? basePrice : null),
      compare_at_price: existing?.compare_at_price ?? null,
      sku: existing?.sku ?? baseSku,
      stock: existing?.stock ?? baseStock,
      barcode: existing?.barcode ?? null
    };
  });
}

function getVariantTitle(variant: VariantRow) {
  return [variant.option1_value, variant.option2_value, variant.option3_value].filter(Boolean).join(" / ");
}

function uniqueValues(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (!value || seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
}

function cartesian(values: string[][]) {
  return values.reduce<string[][]>((acc, current) => acc.flatMap((items) => current.map((value) => [...items, value])), [[]]);
}

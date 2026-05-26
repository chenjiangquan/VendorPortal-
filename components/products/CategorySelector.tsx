"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { flattenCategories, ProductCategory, shopifyFurnitureCategories } from "@/lib/shopify-categories";
import { useI18n } from "@/lib/i18n";

export function CategorySelector({
  defaultCategory,
  defaultCategoryId,
  defaultShopifyCategoryId,
  disabled
}: {
  defaultCategory?: string | null;
  defaultCategoryId?: string | null;
  defaultShopifyCategoryId?: string | null;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [path, setPath] = useState<ProductCategory[]>([]);
  const [selected, setSelected] = useState({
    category: defaultCategory ?? "",
    category_id: defaultCategoryId ?? "",
    shopify_category_id: defaultShopifyCategoryId ?? ""
  });
  const all = useMemo(() => flattenCategories(), []);
  const current = path.length ? path[path.length - 1].children ?? [] : shopifyFurnitureCategories;
  const results = query.trim()
    ? all.filter((category) => `${category.fullName} ${category.name}`.toLowerCase().includes(query.trim().toLowerCase()))
    : current;

  function choose(category: ProductCategory) {
    if (category.children?.length && !query.trim()) {
      setPath([...path, category]);
      return;
    }
    setSelected({
      category: category.fullName,
      category_id: category.id,
      shopify_category_id: category.shopifyTaxonomyId ?? ""
    });
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="relative md:col-span-2">
      <label>
        <span className="text-sm font-medium text-slate-700">{t("product.category")}</span>
        <button type="button" disabled={disabled} onClick={() => setOpen(!open)} className="mt-1 flex w-full items-center justify-between rounded-xl border border-line bg-white px-4 py-2 text-left text-sm shadow-sm disabled:bg-panel">
          <span className={selected.category ? "text-ink" : "text-slate-400"}>{selected.category || "Select category"}</span>
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </button>
      </label>
      <input type="hidden" name="category" value={selected.category} />
      <input type="hidden" name="category_id" value={selected.category_id} />
      <input type="hidden" name="shopify_category_id" value={selected.shopify_category_id} />
      {open && !disabled ? (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-line bg-white shadow-xl">
          <div className="border-b border-line p-3">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search categories" className="focus-ring w-full rounded-xl border border-line px-3 py-2 text-sm" />
            <button type="button" onClick={() => { setPath(path.slice(0, -1)); setQuery(""); }} disabled={!path.length && !query} className="mt-2 text-xs font-semibold text-slate-600 disabled:text-slate-300">
              {path.length || query ? "Back" : "Back to All"}
            </button>
          </div>
          <div className="max-h-80 overflow-auto p-2">
            {results.map((category) => (
              <button key={category.fullName} type="button" onClick={() => choose(category)} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-panel">
                <span>{query ? category.fullName : category.name}</span>
                {category.children?.length && !query.trim() ? <ChevronRight className="h-4 w-4 text-slate-400" /> : null}
              </button>
            ))}
            {!results.length && <p className="p-4 text-sm text-slate-500">No categories found.</p>}
          </div>
        </div>
      ) : null}
    </div>
  );
}

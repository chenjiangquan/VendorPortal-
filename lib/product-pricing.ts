import { formatCurrency } from "@/lib/utils";

export function getDisplayPrice(product: { price?: number | null; has_variants?: boolean | null; product_variants?: { price?: number | null }[] | null }) {
  if (!product.has_variants) {
    return product.price === null || product.price === undefined ? "-" : formatCurrency(product.price);
  }

  const prices = (product.product_variants ?? [])
    .map((variant) => variant.price)
    .filter((price): price is number => price !== null && price !== undefined && Number(price) > 0)
    .map(Number)
    .sort((a, b) => a - b);

  if (!prices.length) return "Variant pricing";
  const min = prices[0];
  const max = prices[prices.length - 1];
  return min === max ? formatCurrency(min) : `${formatCurrency(min)} - ${formatCurrency(max)}`;
}

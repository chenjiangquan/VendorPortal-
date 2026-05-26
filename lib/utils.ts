import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value?: number | string | null, currency = "USD") {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

export function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function numericIdFromGid(gid?: string | null) {
  return gid?.split("/").pop() ?? null;
}

export function splitTags(value?: string | string[] | null) {
  if (Array.isArray(value)) return value;
  return (value ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function shopifyAdminProductUrl(productGid?: string | null) {
  const store = process.env.SHOPIFY_STORE_DOMAIN;
  const id = numericIdFromGid(productGid);
  return store && id ? `https://${store}/admin/products/${id}` : null;
}

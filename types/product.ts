import type { ProductStatus } from "@/types/database";

export type VendorProduct = {
  id: string;
  vendor_id: string;
  title: string;
  description?: string | null;
  price: number | null;
  sku?: string | null;
  stock?: number | null;
  status: ProductStatus;
};

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Role = "admin" | "vendor";
export type ProductStatus = "draft" | "submitted" | "approved" | "rejected" | "shopify_draft" | "archived";
export type VendorOrderStatus = "open" | "tracking_submitted" | "reviewed" | "closed" | "cancelled";
export type TrackingStatus = "submitted" | "reviewed" | "rejected";

export type VendorProductRow = {
  id: string;
  vendor_id: string;
  title: string;
  handle: string | null;
  description: string | null;
  ai_description: string | null;
  final_description: string | null;
  description_data: Json | null;
  product_type: string | null;
  category: string | null;
  tags: string[] | null;
  price: number;
  compare_at_price: number | null;
  cost_price: number | null;
  sku: string | null;
  barcode: string | null;
  stock: number | null;
  status: ProductStatus;
  has_variants: boolean | null;
  options: Json | null;
};

export type VendorProductInsert = Partial<Omit<VendorProductRow, "id">> & {
  vendor_id: string;
  title: string;
  price: number;
};

export type ProductVariantRow = {
  id: string;
  product_id: string;
  vendor_id: string;
  option1_name: string | null;
  option1_value: string | null;
  option2_name: string | null;
  option2_value: string | null;
  option3_name: string | null;
  option3_value: string | null;
  sku: string | null;
  barcode: string | null;
  price: number | null;
  compare_at_price: number | null;
  stock: number | null;
};

export type Database = {
  public: {
    Tables: {
      vendor_products: {
        Row: VendorProductRow;
        Insert: VendorProductInsert;
        Update: Partial<VendorProductRow>;
      };
      product_variants: {
        Row: ProductVariantRow;
        Insert: Partial<Omit<ProductVariantRow, "id">> & { product_id: string; vendor_id: string };
        Update: Partial<ProductVariantRow>;
      };
    } & Record<string, { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }>;
  };
};

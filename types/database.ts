export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Role = "admin" | "vendor";
export type ProductStatus = "draft" | "submitted" | "approved" | "rejected" | "shopify_draft" | "archived";
export type VendorOrderStatus = "open" | "tracking_submitted" | "reviewed" | "closed" | "cancelled";
export type TrackingStatus = "submitted" | "reviewed" | "rejected";

export type Database = {
  public: {
    Tables: Record<string, { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }>;
  };
};

import type { TrackingStatus, VendorOrderStatus } from "@/types/database";

export type VendorOrder = {
  id: string;
  vendor_id: string;
  shopify_order_id: string;
  shopify_order_name?: string | null;
  status: VendorOrderStatus;
};

export type TrackingSubmission = {
  id: string;
  vendor_order_id: string;
  vendor_id: string;
  carrier: string;
  tracking_number: string;
  status: TrackingStatus;
};

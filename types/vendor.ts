export type Vendor = {
  id: string;
  user_id?: string | null;
  company_name: string;
  contact_name?: string | null;
  email: string;
  shopify_vendor_name?: string | null;
  commission_rate?: number | null;
  status: "active" | "suspended" | "archived";
};

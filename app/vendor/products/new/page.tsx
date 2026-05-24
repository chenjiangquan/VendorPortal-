import { DashboardShell } from "@/components/layout/DashboardShell";
import { ProductForm } from "@/components/products/ProductForm";
import { requireVendor } from "@/lib/auth";

export default async function NewProductPage() {
  const { vendor } = await requireVendor();
  return <DashboardShell role="vendor" title="Add Product"><ProductForm vendorId={vendor.id} /></DashboardShell>;
}

import { CreateVendorForm } from "@/components/admin/CreateVendorForm";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { requireRole } from "@/lib/auth";

export default async function NewVendorPage() {
  await requireRole("admin");
  return (
    <DashboardShell role="admin" title="Create Vendor">
      <CreateVendorForm />
    </DashboardShell>
  );
}

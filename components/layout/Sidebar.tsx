"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, ClipboardCheck, Home, KeyRound, Package, Settings, Store, Truck } from "lucide-react";
import { cn } from "@/lib/utils";

const adminItems = [
  { href: "/admin", label: "Dashboard", icon: Home },
  { href: "/admin/vendors", label: "Vendors", icon: Store },
  { href: "/admin/products", label: "New Products", icon: Package },
  { href: "/admin/products/edit-requests", label: "Edit Requests", icon: Package },
  { href: "/admin/products/delete-requests", label: "Delete Requests", icon: Package },
  { href: "/admin/orders", label: "Orders", icon: Boxes },
  { href: "/admin/tracking", label: "Tracking", icon: Truck },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/change-password", label: "Change Password", icon: KeyRound }
];

const vendorItems = [
  { href: "/vendor", label: "Dashboard", icon: Home },
  { href: "/vendor/products", label: "Products", icon: Package },
  { href: "/vendor/orders", label: "Orders", icon: Boxes },
  { href: "/vendor/tracking", label: "Tracking", icon: ClipboardCheck },
  { href: "/vendor/settings", label: "Settings", icon: Settings },
  { href: "/vendor/change-password", label: "Change Password", icon: KeyRound }
];

export function Sidebar({ role }: { role: "admin" | "vendor" }) {
  const pathname = usePathname();
  const items = role === "admin" ? adminItems : vendorItems;

  return (
    <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-line bg-white px-4 py-5 shadow-sm md:block">
      <Link href={`/${role}`} className="block rounded-xl px-3 py-2 text-lg font-semibold text-ink">
        Vendor Portal
      </Link>
      <nav className="mt-6 space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const exactOnly = item.href === `/${role}` || item.href === "/admin/products";
          const active = pathname === item.href || (!exactOnly && pathname.startsWith(`${item.href}/`));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn("flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-panel hover:text-ink", active && "bg-ink text-white shadow-sm hover:bg-ink hover:text-white")}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

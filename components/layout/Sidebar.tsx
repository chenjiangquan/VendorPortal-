"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Boxes, ClipboardCheck, Home, KeyRound, Package, Settings, Store, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

const adminItems = [
  { href: "/admin", labelKey: "nav.dashboard", icon: Home },
  { href: "/admin/vendors", labelKey: "nav.vendors", icon: Store },
  { href: "/admin/products", labelKey: "nav.newProducts", icon: Package },
  { href: "/admin/products/edit-requests", labelKey: "nav.editRequests", icon: Package },
  { href: "/admin/products/delete-requests", labelKey: "nav.deleteRequests", icon: Package },
  { href: "/admin/orders", labelKey: "nav.orders", icon: Boxes },
  { href: "/admin/tracking", labelKey: "nav.tracking", icon: Truck },
  { href: "/admin/settings", labelKey: "nav.settings", icon: Settings },
  { href: "/admin/change-password", labelKey: "nav.changePassword", icon: KeyRound }
];

type SidebarCounts = {
  newProducts: number;
  editRequests: number;
  deleteRequests: number;
};

const vendorItems = [
  { href: "/vendor", labelKey: "nav.dashboard", icon: Home },
  { href: "/vendor/products", labelKey: "nav.products", icon: Package },
  { href: "/vendor/orders", labelKey: "nav.orders", icon: Boxes },
  { href: "/vendor/tracking", labelKey: "nav.tracking", icon: ClipboardCheck },
  { href: "/vendor/settings", labelKey: "nav.settings", icon: Settings },
  { href: "/vendor/change-password", labelKey: "nav.changePassword", icon: KeyRound }
];

export function Sidebar({ role }: { role: "admin" | "vendor" }) {
  const pathname = usePathname();
  const { language, setLanguage, t } = useI18n();
  const items = role === "admin" ? adminItems : vendorItems;
  const [counts, setCounts] = useState<SidebarCounts>({ newProducts: 0, editRequests: 0, deleteRequests: 0 });

  useEffect(() => {
    if (role !== "admin") return;
    let cancelled = false;
    const cached = window.sessionStorage.getItem("admin-sidebar-counts");
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as { counts: SidebarCounts; createdAt: number };
        if (Date.now() - parsed.createdAt < 10_000) {
          setCounts(parsed.counts);
          return;
        }
      } catch {
        window.sessionStorage.removeItem("admin-sidebar-counts");
      }
    }
    fetch("/api/admin/sidebar-counts", { cache: "no-store" })
      .then((res) => res.ok ? res.json() : null)
      .then((json) => {
        if (!cancelled && json) {
          setCounts(json);
          window.sessionStorage.setItem("admin-sidebar-counts", JSON.stringify({ counts: json, createdAt: Date.now() }));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [role]);

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
          const count = getAdminMenuCount(item.href, counts);
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={cn("flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-panel hover:text-ink", active && "bg-ink text-white shadow-sm hover:bg-ink hover:text-white")}
            >
              <Icon className="h-4 w-4" />
              <span>{t(item.labelKey as any)}</span>
              {count > 0 && (
                <span className={cn("ml-auto rounded-full px-2 py-0.5 text-xs font-semibold", active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700")}>
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="absolute bottom-5 left-4 right-4 rounded-2xl border border-line bg-panel p-3">
        <div className="text-xs font-semibold uppercase text-slate-500">{t("nav.language")}</div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setLanguage("en")} className={cn("rounded-xl px-3 py-2 text-sm font-semibold", language === "en" ? "bg-ink text-white" : "bg-white text-slate-700")}>{t("nav.english")}</button>
          <button type="button" onClick={() => setLanguage("zh")} className={cn("rounded-xl px-3 py-2 text-sm font-semibold", language === "zh" ? "bg-ink text-white" : "bg-white text-slate-700")}>{t("nav.chinese")}</button>
        </div>
      </div>
    </aside>
  );
}

function getAdminMenuCount(href: string, counts: SidebarCounts) {
  if (href === "/admin/products") return counts.newProducts;
  if (href === "/admin/products/edit-requests") return counts.editRequests;
  if (href === "/admin/products/delete-requests") return counts.deleteRequests;
  return 0;
}

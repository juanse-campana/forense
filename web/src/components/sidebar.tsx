"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Upload, History, LayoutDashboard, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { key: "upload", href: "/", icon: Upload },
  { key: "history", href: "/history", icon: History },
  { key: "dashboard", href: "/dashboard", icon: LayoutDashboard },
];

export function Sidebar() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const isActive = (href: string) => {
    const path = pathname.replace(`/${locale}`, "");
    if (href === "/") return path === "" || path === "/";
    return path.startsWith(href);
  };

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 md:hidden p-2 rounded bg-surface outline outline-1 outline-outline-variant text-on-surface"
        aria-label="Toggle menu"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-40 h-full bg-surface outline outline-1 outline-outline-variant flex flex-col transition-all duration-200",
          "w-[240px] md:w-16 lg:w-[240px]",
          "md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center h-14 px-4 border-b border-outline-variant/50">
          <span className="text-xl font-bold text-primary hidden lg:block">Forense</span>
          <span className="text-xl font-bold text-primary lg:hidden mx-auto">F</span>
        </div>

        <nav className="flex-1 py-4 space-y-1">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.key}
                href={`/${locale}${item.href}`}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors relative",
                  active
                    ? "text-secondary bg-secondary/10"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                )}
              >
                {active && (
                  <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-secondary" />
                )}
                <item.icon size={18} className="shrink-0" />
                <span className="hidden lg:inline">{t(item.key)}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-outline-variant/50 hidden lg:block">
          <p className="text-xs text-on-surface-variant">
            Forense v0.1.0
          </p>
        </div>
      </aside>
    </>
  );
}

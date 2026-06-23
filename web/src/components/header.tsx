"use client";

import * as React from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";

export function Header() {
  const t = useTranslations("locale");
  const locale = useLocale();
  const pathname = usePathname();
  const otherLocale = locale === "es" ? "en" : "es";

  const switchPath = pathname.replace(`/${locale}`, `/${otherLocale}`);

  return (
    <header
      className="sticky top-0 z-30 h-14 flex items-center justify-between px-6 border-b border-outline-variant/50"
      style={{
        backgroundColor: "rgba(15, 20, 24, 0.8)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <h1 className="text-2xl font-semibold leading-snug text-on-surface">
        Forense
      </h1>

      <div className="flex items-center gap-4">
        <Link
          href={switchPath}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors",
            "bg-surface-container-high text-on-surface-variant hover:text-on-surface outline outline-1 outline-outline-variant"
          )}
        >
          <Globe size={16} />
          <span>{t(otherLocale)}</span>
        </Link>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/comercial/orcamentos", label: "Orçamentos" },
  { href: "/comercial/propostas", label: "Propostas" },
];

export default function ComercialTabs() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 overflow-x-auto border-b border-border-neutral">
      {TABS.map((t) => {
        const active = pathname?.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`shrink-0 rounded-t-btn px-3.5 py-2.5 text-[13px] ${
              active ? "border-b-2 border-gold font-semibold text-gold" : "text-text-secondary hover:text-text"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

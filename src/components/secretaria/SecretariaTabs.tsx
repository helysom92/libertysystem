"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/secretaria/clientes", label: "Clientes" },
  { href: "/secretaria/fornecedores", label: "Fornecedores" },
  { href: "/secretaria/produtos", label: "Produtos" },
  { href: "/secretaria/financeiro", label: "Financeiro" },
];

export default function SecretariaTabs() {
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

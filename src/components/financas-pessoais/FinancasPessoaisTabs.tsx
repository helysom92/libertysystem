"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/financas-pessoais/visao-geral", label: "Visão Geral" },
  { href: "/financas-pessoais/receitas-despesas", label: "Receitas e Despesas" },
  { href: "/financas-pessoais/contas", label: "Contas e Transferências" },
  { href: "/financas-pessoais/cartoes", label: "Cartões e Faturas" },
  { href: "/financas-pessoais/dividas", label: "Dívidas" },
  { href: "/financas-pessoais/investimentos", label: "Investimentos" },
  { href: "/financas-pessoais/importacoes", label: "Importações" },
];

export default function FinancasPessoaisTabs() {
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

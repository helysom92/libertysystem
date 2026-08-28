"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import SeletorMesFinanceiro from "./SeletorMesFinanceiro";

const TABS = [
  { href: "/financeiro/visao-geral", label: "Visão Geral" },
  { href: "/financeiro/recebimentos", label: "Recebimentos" },
  { href: "/financeiro/lancamentos", label: "Lançamentos" },
  { href: "/financeiro/despesas", label: "Despesas" },
  { href: "/financeiro/comprovantes", label: "Comprovantes" },
];

export default function FinanceiroTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Preserva o mês selecionado ao trocar de aba — sem isso, cada aba voltaria a ler o mês
  // atual sozinha e o usuário perderia o contexto que acabou de escolher.
  const query = searchParams.toString();

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-neutral">
      <div className="flex gap-1 overflow-x-auto">
        {TABS.map((t) => {
          const active = pathname?.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={query ? `${t.href}?${query}` : t.href}
              className={`shrink-0 rounded-t-btn px-3.5 py-2.5 text-[13px] ${
                active ? "border-b-2 border-gold font-semibold text-gold" : "text-text-secondary hover:text-text"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
      <SeletorMesFinanceiro />
    </div>
  );
}

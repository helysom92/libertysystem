"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/actions/auth";

const TAB_LABELS: Record<string, string> = {
  hoje: "Hoje",
  servicos: "Serviços",
  agenda: "Agenda",
  financeiro: "Financeiro",
  gestao: "Gestão",
};

export default function Sidebar({
  tabs,
  roleLabel,
  nome,
}: {
  tabs: string[];
  roleLabel: string;
  nome: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex w-[230px] shrink-0 flex-col border-r border-border-neutral bg-card-secondary px-5 py-7">
      <div className="mb-1">
        <span className="font-display text-xl font-bold text-gradient-gold">Liberty</span>
      </div>
      <p className="mb-8 text-[10.5px] tracking-wide text-text-muted uppercase">
        Sistema Operacional
      </p>

      <nav className="flex flex-col gap-1">
        {tabs.map((tab) => {
          const href = `/${tab}`;
          const active = pathname?.startsWith(href);
          return (
            <Link
              key={tab}
              href={href}
              className={`rounded-btn px-3 py-2 text-[13.5px] transition-colors ${
                active
                  ? "bg-card font-semibold text-gold"
                  : "text-text-secondary hover:bg-card hover:text-text"
              }`}
            >
              {TAB_LABELS[tab] ?? tab}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-border-neutral pt-5">
        <p className="mb-1 text-[10.5px] tracking-wide text-text-muted uppercase">{nome}</p>
        <p className="mb-3 text-[13px] font-semibold text-gold">{roleLabel}</p>
        <form action={signOut}>
          <button
            type="submit"
            className="text-[12px] text-text-muted underline-offset-2 hover:text-text hover:underline"
          >
            Sair
          </button>
        </form>
      </div>
    </aside>
  );
}

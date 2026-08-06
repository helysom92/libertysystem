"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/actions/auth";

const TAB_LABELS: Record<string, string> = {
  hoje: "Hoje",
  administrativo: "Administrativo",
  servicos: "Serviços",
  agenda: "Agenda",
  gestao: "Gestão",
};

// Grupos exibidos na sidebar, na ordem certa — "hoje" fica de fora (item solto no topo).
const GROUPS: { label: string; tabs: string[] }[] = [
  { label: "Operacional", tabs: ["servicos", "agenda"] },
  { label: "Administrativo", tabs: ["administrativo"] },
  { label: "Gestão", tabs: ["gestao"] },
];

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
    <aside className="no-print flex w-[230px] shrink-0 flex-col border-r border-border-neutral bg-card-secondary px-5 py-7">
      <div className="mb-1">
        <Image src="/liberty-logo.png" alt="Liberty" width={160} height={44} priority className="h-7 w-auto object-contain" />
      </div>
      <p className="mb-8 text-[10.5px] tracking-wide text-text-muted uppercase">
        Sistema Operacional
      </p>

      <nav className="flex flex-col gap-1">
        {tabs.includes("hoje") && (
          <Link
            href="/hoje"
            className={`rounded-btn px-3 py-2 text-[13.5px] transition-colors ${
              pathname?.startsWith("/hoje")
                ? "bg-card font-semibold text-gold"
                : "text-text-secondary hover:bg-card hover:text-text"
            }`}
          >
            {TAB_LABELS.hoje}
          </Link>
        )}

        {GROUPS.map((group) => {
          const groupTabs = group.tabs.filter((t) => tabs.includes(t));
          if (groupTabs.length === 0) return null;
          return (
            <div key={group.label} className="mt-3 flex flex-col gap-1 first:mt-0">
              <p className="mb-1 px-3 text-[10px] font-semibold tracking-wide text-text-muted uppercase">
                {group.label}
              </p>
              {groupTabs.map((tab) => {
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
            </div>
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

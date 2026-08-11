"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/actions/auth";

const TAB_LABELS: Record<string, string> = {
  gestao: "Gestão",
  hoje: "Hoje",
  secretaria: "Secretaria",
  comercial: "Comercial",
  producao: "Produção",
};

const TAB_ICONS: Record<string, string> = {
  gestao: "📊",
  hoje: "☀️",
  secretaria: "🗂️",
  comercial: "💼",
  producao: "🛠️",
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
    <>
      {/* Desktop: sidebar fixa lateral */}
      <aside className="no-print hidden w-[230px] shrink-0 flex-col border-r border-border-neutral bg-card-secondary px-5 py-7 md:flex">
        <div className="mb-1">
          <Image src="/liberty-logo.png" alt="Liberty" width={160} height={44} priority className="h-7 w-auto object-contain" />
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

      {/* Mobile/tablet: barra superior enxuta + navegação fixa embaixo */}
      <header className="no-print flex items-center justify-between border-b border-border-neutral bg-card-secondary px-4 py-3 md:hidden">
        <Image src="/liberty-logo.png" alt="Liberty" width={128} height={35} priority className="h-6 w-auto object-contain" />
        <div className="flex items-center gap-3">
          <p className="text-[11px] font-semibold text-gold">{roleLabel}</p>
          <form action={signOut}>
            <button type="submit" className="text-[11px] text-text-muted underline-offset-2 hover:text-text">
              Sair
            </button>
          </form>
        </div>
      </header>

      <nav className="no-print fixed inset-x-0 bottom-0 z-40 flex border-t border-border-neutral bg-card-secondary md:hidden">
        {tabs.map((tab) => {
          const href = `/${tab}`;
          const active = pathname?.startsWith(href);
          return (
            <Link
              key={tab}
              href={href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10.5px] transition-colors ${
                active ? "text-gold" : "text-text-secondary"
              }`}
            >
              <span className="text-base leading-none">{TAB_ICONS[tab] ?? "•"}</span>
              {TAB_LABELS[tab] ?? tab}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

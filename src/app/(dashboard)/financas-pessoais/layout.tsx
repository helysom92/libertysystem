import { Suspense } from "react";
import { requireHelysom } from "@/lib/domain/permissions";
import FinancasPessoaisTabs from "@/components/financas-pessoais/FinancasPessoaisTabs";

export default async function FinancasPessoaisLayout({ children }: { children: React.ReactNode }) {
  // Guarda por identidade (e-mail exato), não por papel — nem outro administrador entra aqui.
  await requireHelysom();

  return (
    <div className="flex h-full flex-col">
      {/* FinancasPessoaisTabs usa useSearchParams() (seletor de mês) — precisa de Suspense pra
       * não forçar toda a rota a virar client-rendered, mesmo padrão do FinanceiroTabs. */}
      <Suspense fallback={<div className="h-[45px] border-b border-border-neutral" />}>
        <FinancasPessoaisTabs />
      </Suspense>
      <div className="mt-5 flex-1">{children}</div>
    </div>
  );
}

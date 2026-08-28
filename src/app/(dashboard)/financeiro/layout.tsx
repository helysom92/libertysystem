import { Suspense } from "react";
import { requireTab } from "@/lib/domain/permissions";
import FinanceiroTabs from "@/components/financeiro/FinanceiroTabs";

export default async function FinanceiroLayout({ children }: { children: React.ReactNode }) {
  await requireTab("financeiro");

  return (
    <div className="flex h-full flex-col">
      {/* FinanceiroTabs usa useSearchParams() (seletor de mês) — precisa de Suspense pra não
       * forçar toda a rota a virar client-rendered. */}
      <Suspense fallback={<div className="h-[45px] border-b border-border-neutral" />}>
        <FinanceiroTabs />
      </Suspense>
      <div className="mt-5 flex-1">{children}</div>
    </div>
  );
}

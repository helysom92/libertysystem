import { requireTab } from "@/lib/domain/permissions";
import FinanceiroTabs from "@/components/financeiro/FinanceiroTabs";

export default async function FinanceiroLayout({ children }: { children: React.ReactNode }) {
  await requireTab("financeiro");

  return (
    <div className="flex h-full flex-col">
      <FinanceiroTabs />
      <div className="mt-5 flex-1">{children}</div>
    </div>
  );
}

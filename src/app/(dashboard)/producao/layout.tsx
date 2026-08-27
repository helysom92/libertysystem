import { requireTab } from "@/lib/domain/permissions";
import ProducaoTabs from "@/components/producao/ProducaoTabs";

export default async function ProducaoLayout({ children }: { children: React.ReactNode }) {
  await requireTab("producao");

  return (
    <div className="flex h-full flex-col">
      <ProducaoTabs />
      <div className="mt-5 flex-1">{children}</div>
    </div>
  );
}

import { requireTab } from "@/lib/domain/permissions";
import ComercialTabs from "@/components/comercial/ComercialTabs";

export default async function ComercialLayout({ children }: { children: React.ReactNode }) {
  await requireTab("comercial");

  return (
    <div className="flex h-full flex-col">
      <ComercialTabs />
      <div className="mt-5 flex-1">{children}</div>
    </div>
  );
}

import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { allowedTabs, homeTabFor } from "@/lib/domain/flows";
import FinanceiroTabs from "@/components/financeiro/FinanceiroTabs";

export default async function FinanceiroLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  const role = profile?.role ?? "secretaria";
  if (!allowedTabs(role).includes("financeiro")) {
    redirect(`/${homeTabFor(role)}`);
  }

  return (
    <div className="flex h-full flex-col">
      <FinanceiroTabs />
      <div className="mt-5 flex-1">{children}</div>
    </div>
  );
}

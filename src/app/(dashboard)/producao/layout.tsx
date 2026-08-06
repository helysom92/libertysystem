import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { allowedTabs, homeTabFor } from "@/lib/domain/flows";
import ProducaoTabs from "@/components/producao/ProducaoTabs";

export default async function ProducaoLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  const role = profile?.role ?? "secretaria";
  if (!allowedTabs(role).includes("producao")) {
    redirect(`/${homeTabFor(role)}`);
  }

  return (
    <div className="flex h-full flex-col">
      <ProducaoTabs />
      <div className="mt-5 flex-1">{children}</div>
    </div>
  );
}

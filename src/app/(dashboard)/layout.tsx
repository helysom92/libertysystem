import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { allowedTabs, ROLE_LABELS } from "@/lib/domain/flows";
import { isHelysom } from "@/lib/domain/permissions";
import Sidebar from "@/components/ui/Sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }

  // Finanças Pessoais não é um tab de papel (não entra em allowedTabs) — é exclusivo da
  // identidade do Helysom, então só aparece no menu quando o e-mail autenticado bate. Fica
  // como primeiro item do menu (pedido dele), antes de Gestão.
  const tabs = isHelysom(profile) ? ["financas-pessoais", ...allowedTabs(profile.role)] : allowedTabs(profile.role);

  return (
    <div className="flex min-h-screen w-full flex-col bg-bg md:flex-row">
      <Sidebar tabs={tabs} roleLabel={ROLE_LABELS[profile.role]} nome={profile.nome} />
      <main className="flex-1 overflow-x-auto px-4 py-5 pb-20 sm:px-6 md:px-7 md:py-8 md:pb-8">
        {children}
      </main>
    </div>
  );
}

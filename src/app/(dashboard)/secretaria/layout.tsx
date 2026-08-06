import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { allowedTabs, homeTabFor } from "@/lib/domain/flows";
import SecretariaTabs from "@/components/secretaria/SecretariaTabs";

export default async function SecretariaLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  const role = profile?.role ?? "secretaria";
  if (!allowedTabs(role).includes("secretaria")) {
    redirect(`/${homeTabFor(role)}`);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-xl font-bold">Secretaria</h1>
        <p className="text-[13px] text-text-secondary">
          Cadastros e lançamentos do dia a dia
        </p>
      </div>
      <SecretariaTabs />
      <div className="mt-5">{children}</div>
    </div>
  );
}

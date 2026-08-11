import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { allowedTabs, homeTabFor } from "@/lib/domain/flows";
import ComercialTabs from "@/components/comercial/ComercialTabs";

export default async function ComercialLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  const role = profile?.role ?? "secretaria";
  if (!allowedTabs(role).includes("comercial")) {
    redirect(`/${homeTabFor(role)}`);
  }

  return (
    <div className="flex h-full flex-col">
      <ComercialTabs />
      <div className="mt-5 flex-1">{children}</div>
    </div>
  );
}

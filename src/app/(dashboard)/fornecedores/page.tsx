import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { allowedTabs, homeTabFor } from "@/lib/domain/flows";
import type { Fornecedor } from "@/lib/domain/types";
import FornecedoresList from "@/components/fornecedores/FornecedoresList";

export default async function FornecedoresPage() {
  const profile = await getCurrentProfile();
  const role = profile?.role ?? "secretaria";
  if (!allowedTabs(role).includes("fornecedores")) {
    redirect(`/${homeTabFor(role)}`);
  }

  const supabase = await createClient();
  const { data: fornecedores } = await supabase.from("fornecedores").select("*").order("nome");

  return <FornecedoresList fornecedores={(fornecedores as Fornecedor[]) ?? []} />;
}

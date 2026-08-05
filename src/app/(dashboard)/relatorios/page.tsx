import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { allowedTabs, homeTabFor } from "@/lib/domain/flows";
import type { Cliente, Fornecedor, Lancamento, Servico } from "@/lib/domain/types";
import RelatoriosClient from "@/components/relatorios/RelatoriosClient";

export default async function RelatoriosPage() {
  const profile = await getCurrentProfile();
  const role = profile?.role ?? "secretaria";
  if (!allowedTabs(role).includes("relatorios")) {
    redirect(`/${homeTabFor(role)}`);
  }

  const supabase = await createClient();

  const [{ data: servicos }, { data: clientes }, { data: lancamentos }, { data: fornecedores }] =
    await Promise.all([
      supabase.from("servicos").select("*"),
      supabase.from("clientes").select("*").order("nome"),
      supabase.from("lancamentos").select("*").order("data", { ascending: false }),
      supabase.from("fornecedores").select("*"),
    ]);

  return (
    <RelatoriosClient
      servicos={(servicos as Servico[]) ?? []}
      clientes={(clientes as Cliente[]) ?? []}
      lancamentos={(lancamentos as Lancamento[]) ?? []}
      fornecedores={(fornecedores as Fornecedor[]) ?? []}
    />
  );
}

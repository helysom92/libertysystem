import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { allowedTabs, homeTabFor } from "@/lib/domain/flows";
import type { ItemOrcamento, Material } from "@/lib/domain/types";
import MateriaisList from "@/components/materiais/MateriaisList";
import ItensOrcamentoList from "@/components/materiais/ItensOrcamentoList";
import RegrasComerciais from "@/components/materiais/RegrasComerciais";

export default async function ProdutosPage() {
  const profile = await getCurrentProfile();
  const role = profile?.role ?? "secretaria";
  if (!allowedTabs(role).includes("produtos")) {
    redirect(`/${homeTabFor(role)}`);
  }

  const supabase = await createClient();
  const [{ data: itens }, { data: materiais }] = await Promise.all([
    supabase.from("itens_orcamento").select("*").order("nome"),
    supabase.from("materiais").select("*").order("nome"),
  ]);

  return (
    <div>
      <RegrasComerciais />
      <ItensOrcamentoList itens={(itens as ItemOrcamento[]) ?? []} />
      <MateriaisList materiais={(materiais as Material[]) ?? []} />
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import type { ItemOrcamento, Material } from "@/lib/domain/types";
import MateriaisList from "@/components/materiais/MateriaisList";
import ItensOrcamentoList from "@/components/materiais/ItensOrcamentoList";
import RegrasComerciais from "@/components/materiais/RegrasComerciais";

export default async function MateriaisPage() {
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

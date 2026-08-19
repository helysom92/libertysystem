import { createClient } from "@/lib/supabase/server";
import VisaoGeralServicosTable from "@/components/producao/VisaoGeralServicosTable";
import type { ItemOrcamento, Servico } from "@/lib/domain/types";
import type { Coluna } from "@/lib/domain/kanban";

export default async function VisaoGeralPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string }>;
}) {
  const { open } = await searchParams;
  const supabase = await createClient();

  const [{ data: servicos }, { data: itensOrcamento }, { data: colunas }] = await Promise.all([
    supabase.from("servicos").select("*").not("numero", "is", null).order("prazo"),
    supabase.from("itens_orcamento").select("*").eq("ativo", true).order("nome"),
    supabase.from("colunas").select("*").order("ordem"),
  ]);

  return (
    <VisaoGeralServicosTable
      servicos={(servicos as Servico[]) ?? []}
      colunas={(colunas as Coluna[]) ?? []}
      itensOrcamento={(itensOrcamento as ItemOrcamento[]) ?? []}
      initialOpenId={open ?? null}
    />
  );
}

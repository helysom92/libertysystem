import { createClient } from "@/lib/supabase/server";
import { requireTab } from "@/lib/domain/permissions";
import VisaoGeralServicosTable from "@/components/producao/VisaoGeralServicosTable";
import type { ItemOrcamento, Servico } from "@/lib/domain/types";
import type { Coluna } from "@/lib/domain/kanban";
import { CAMPOS_SERVICO_PRODUCAO, toServicoProducaoSafe } from "@/lib/domain/servicoProducao";

export default async function VisaoGeralPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string }>;
}) {
  const { open } = await searchParams;
  const profile = await requireTab("producao");
  const supabase = await createClient();

  // Duas queries separadas (não uma com o nome da coluna condicional) — o cliente do Supabase
  // tenta tipar o retorno a partir da string do `.select()` em tempo de compilação, e uma
  // string condicional dentro do `.select()` quebra esse parser de tipos.
  const servicosQuery =
    profile.role === "producao"
      ? supabase.from("servicos").select(CAMPOS_SERVICO_PRODUCAO).not("numero", "is", null).order("prazo")
      : supabase.from("servicos").select("*").not("numero", "is", null).order("prazo");

  const [{ data: servicos }, { data: itensOrcamento }, { data: colunas }] = await Promise.all([
    servicosQuery,
    supabase.from("itens_orcamento").select("*").eq("ativo", true).order("nome"),
    supabase.from("colunas").select("*").order("ordem"),
  ]);

  const svs =
    profile.role === "producao"
      ? ((servicos ?? []) as unknown as Parameters<typeof toServicoProducaoSafe>[0][]).map(toServicoProducaoSafe)
      : ((servicos as unknown as Servico[]) ?? []);

  return (
    <VisaoGeralServicosTable
      role={profile.role}
      servicos={svs}
      colunas={(colunas as Coluna[]) ?? []}
      itensOrcamento={(itensOrcamento as ItemOrcamento[]) ?? []}
      initialOpenId={open ?? null}
    />
  );
}

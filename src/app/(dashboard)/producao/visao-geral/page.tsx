import { createClient } from "@/lib/supabase/server";
import { requireTab } from "@/lib/domain/permissions";
import VisaoGeralServicosTable from "@/components/producao/VisaoGeralServicosTable";
import type { ItemOrcamento, Servico } from "@/lib/domain/types";
import type { Coluna } from "@/lib/domain/kanban";
import { toServicoProducaoSafe } from "@/lib/domain/servicoProducao";

export default async function VisaoGeralPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string }>;
}) {
  const { open } = await searchParams;
  const profile = await requireTab("producao");
  const supabase = await createClient();

  // Correção pontual: a RLS de `servicos` agora só libera SELECT pra admin/secretaria (antes
  // vazava valor/financeiro_status pra Produção). Produção busca pela função segura
  // (`listar_servicos_producao`, sem filtro/ordenação de servidor — filtra/ordena aqui,
  // mesmo resultado de antes) — Admin/Secretaria continuam com a query direta.
  const [{ data: servicosRaw }, { data: itensOrcamento }, { data: colunas }] = await Promise.all([
    profile.role === "producao"
      ? supabase.rpc("listar_servicos_producao")
      : supabase.from("servicos").select("*").not("numero", "is", null).order("prazo"),
    supabase.from("itens_orcamento").select("*").eq("ativo", true).order("nome"),
    supabase.from("colunas").select("*").order("ordem"),
  ]);

  const svs =
    profile.role === "producao"
      ? ((servicosRaw ?? []) as unknown as Parameters<typeof toServicoProducaoSafe>[0][])
          .map(toServicoProducaoSafe)
          .filter((s) => s.numero != null)
          .sort((a, b) => (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999"))
      : ((servicosRaw as unknown as Servico[]) ?? []);

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

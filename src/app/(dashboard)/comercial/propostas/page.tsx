import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import PropostasClient from "@/components/comercial/PropostasClient";
import type { ItemOrcamento, Servico } from "@/lib/domain/types";
import type { Coluna } from "@/lib/domain/kanban";

export default async function ComercialPropostasPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const [{ data: servicos }, { data: opcoes }, { data: itensOrcamento }, { data: colunas }] =
    await Promise.all([
      supabase
        .from("servicos")
        .select("*")
        .not("share_token", "is", null)
        .order("proposta_escolhida_em", { ascending: false, nullsFirst: false })
        .order("criado_em", { ascending: false }),
      supabase.from("proposta_opcoes").select("servico_id"),
      supabase.from("itens_orcamento").select("*").eq("ativo", true).order("nome"),
      supabase.from("colunas").select("*").order("ordem"),
    ]);

  const opcoesCountBySvId: Record<string, number> = {};
  for (const row of opcoes ?? []) {
    opcoesCountBySvId[row.servico_id] = (opcoesCountBySvId[row.servico_id] ?? 0) + 1;
  }

  return (
    <PropostasClient
      servicos={(servicos as Servico[]) ?? []}
      opcoesCountBySvId={opcoesCountBySvId}
      colunas={(colunas as Coluna[]) ?? []}
      role={profile?.role ?? "secretaria"}
      itensOrcamento={(itensOrcamento as ItemOrcamento[]) ?? []}
    />
  );
}

import { createClient } from "@/lib/supabase/server";
import { periodoDoMes } from "@/lib/domain/financas";
import { hojeISOOperacao } from "@/lib/domain/dates";
import type { ItemOrcamento, Servico } from "@/lib/domain/types";
import type { Coluna } from "@/lib/domain/kanban";
import IndicadoresComercialClient from "@/components/comercial/IndicadoresComercialClient";

export default async function ComercialIndicadoresPage() {
  const supabase = await createClient();

  const [{ data: servicos }, { data: colunas }, { data: itensOrcamento }] = await Promise.all([
    supabase.from("servicos").select("*").order("criado_em", { ascending: false }),
    supabase.from("colunas").select("*").order("ordem"),
    supabase.from("itens_orcamento").select("*").eq("ativo", true).order("nome"),
  ]);

  const hojeISO = hojeISOOperacao();
  const [ano, mes] = hojeISO.split("-").map(Number);
  const periodo = periodoDoMes(ano, mes);

  return (
    <IndicadoresComercialClient
      servicos={(servicos as Servico[]) ?? []}
      colunas={(colunas as Coluna[]) ?? []}
      itensOrcamento={(itensOrcamento as ItemOrcamento[]) ?? []}
      periodo={periodo}
      hojeISO={hojeISO}
    />
  );
}

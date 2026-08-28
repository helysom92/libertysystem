import { createClient } from "@/lib/supabase/server";
import { podeVerRetiradaDeLucro, requireTab } from "@/lib/domain/permissions";
import { resolverPeriodoDaUrl } from "@/lib/domain/periodoFinanceiro";
import { periodoDoMes } from "@/lib/domain/financas";
import type { Fornecedor, Lancamento, ServicoParaVinculo } from "@/lib/domain/types";
import FluxoDiario from "@/components/financeiro/FluxoDiario";

export default async function FinanceiroLancamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string; mes?: string; geral?: string }>;
}) {
  const params = await searchParams;
  const profile = await requireTab("financeiro");
  const supabase = await createClient();
  const { ano, mes } = resolverPeriodoDaUrl(params);
  const geral = params.geral === "1";
  const periodo = periodoDoMes(ano, mes);

  let lancamentosQuery = supabase.from("lancamentos").select("*").order("data", { ascending: false });
  if (!geral) {
    lancamentosQuery = lancamentosQuery.gte("data", periodo.inicio).lte("data", periodo.fim);
  }
  // Retirada de lucro é assunto de Administrador/Gestão — Secretaria não deve ver isso na
  // lista de lançamentos, mesmo tendo acesso total ao resto do Financeiro operacional.
  if (!podeVerRetiradaDeLucro(profile.role)) {
    lancamentosQuery = lancamentosQuery.neq("categoria", "Retirada de Lucro");
  }

  const [{ data: lancamentos }, { data: fornecedores }, { data: servicos }] = await Promise.all([
    lancamentosQuery,
    supabase.from("fornecedores").select("*").eq("ativo", true).order("nome"),
    supabase.from("servicos").select("id, numero, cliente, descricao").not("numero", "is", null),
  ]);

  return (
    <FluxoDiario
      lancamentos={(lancamentos as Lancamento[]) ?? []}
      fornecedores={(fornecedores as Fornecedor[]) ?? []}
      servicos={(servicos as ServicoParaVinculo[]) ?? []}
      geral={geral}
      ano={ano}
      mes={mes}
    />
  );
}

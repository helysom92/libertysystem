import { createClient } from "@/lib/supabase/server";
import { podeVerRetiradaDeLucro, requireTab } from "@/lib/domain/permissions";
import { resolverPeriodoDaUrl } from "@/lib/domain/periodoFinanceiro";
import { periodoDoMes } from "@/lib/domain/financas";
import { hojeISOOperacao } from "@/lib/domain/dates";
import type {
  DespesaFixa,
  DespesaFixaOcorrencia,
  DespesaVariavel,
  DespesaVariavelOcorrencia,
  Fornecedor,
  Lancamento,
  LancamentoAtalho,
  ServicoParaVinculo,
} from "@/lib/domain/types";
import DespesasClient from "@/components/financeiro/DespesasClient";

export default async function FinanceiroDespesasPage({
  searchParams,
}: {
  searchParams: Promise<{ abrir?: string; secao?: string; ano?: string; mes?: string; geral?: string }>;
}) {
  const params = await searchParams;
  const profile = await requireTab("financeiro");
  const supabase = await createClient();
  const { ano, mes } = resolverPeriodoDaUrl(params);
  const geral = params.geral === "1";
  const periodo = periodoDoMes(ano, mes);
  const [anoAtual, mesAtual] = hojeISOOperacao().split("-").map(Number);
  const ehMesAtual = ano === anoAtual && mes === mesAtual;

  let despesasLancamentosQuery = supabase.from("lancamentos").select("*").eq("tipo", "Despesa").order("data", { ascending: false });
  if (!geral) {
    despesasLancamentosQuery = despesasLancamentosQuery.gte("data", periodo.inicio).lte("data", periodo.fim);
  }
  // Mesma regra da lista de Lançamentos — retirada de lucro é assunto de Administrador/Gestão.
  if (!podeVerRetiradaDeLucro(profile.role)) {
    despesasLancamentosQuery = despesasLancamentosQuery.neq("categoria", "Retirada de Lucro");
  }

  const [
    { data: despesasFixasRaw },
    { data: despesasVarRaw },
    { data: fornecedores },
    { data: atalhos },
    { data: lancamentos },
    { data: servicosRaw },
  ] = await Promise.all([
    supabase.from("despesas_fixas").select("*").eq("ativo", true).order("dia_vencimento"),
    supabase.from("despesas_variaveis").select("*").eq("ativo", true).order("descricao"),
    supabase.from("fornecedores").select("*").eq("ativo", true).order("nome"),
    supabase.from("lancamento_atalhos").select("*").eq("ativo", true).order("ordem"),
    despesasLancamentosQuery,
    supabase
      .from("servicos")
      .select("id, numero, cliente, descricao")
      .not("numero", "is", null)
      .order("criado_em", { ascending: false }),
  ]);

  const despesasFixas = (despesasFixasRaw as DespesaFixa[]) ?? [];
  const despesasVariaveis = (despesasVarRaw as DespesaVariavel[]) ?? [];

  // Lazily ensure this month's occurrence row exists — só pro mês ATUAL de verdade (nunca
  // pra um mês passado/futuro navegado pelo seletor), senão só abrir a página num mês futuro já
  // materializaria ocorrências que ainda não deveriam existir.
  if (ehMesAtual) {
    await Promise.all([
      despesasFixas.length > 0
        ? supabase.from("despesas_fixas_ocorrencias").upsert(
            despesasFixas.map((d) => ({ despesa_fixa_id: d.id, ano, mes, pago: false })),
            { onConflict: "despesa_fixa_id,ano,mes", ignoreDuplicates: true }
          )
        : Promise.resolve(),
      despesasVariaveis.length > 0
        ? supabase.from("despesas_variaveis_ocorrencias").upsert(
            despesasVariaveis.map((d) => ({
              despesa_variavel_id: d.id,
              ano,
              mes,
              valor_real: d.valor_provisionado,
              pago: false,
            })),
            { onConflict: "despesa_variavel_id,ano,mes", ignoreDuplicates: true }
          )
        : Promise.resolve(),
    ]);
  }

  const [{ data: ocorrenciasFixas }, { data: ocorrenciasVar }] = await Promise.all([
    supabase.from("despesas_fixas_ocorrencias").select("*").eq("ano", ano).eq("mes", mes),
    supabase.from("despesas_variaveis_ocorrencias").select("*").eq("ano", ano).eq("mes", mes),
  ]);

  return (
    <DespesasClient
      despesasFixas={despesasFixas}
      ocorrenciasFixas={(ocorrenciasFixas as DespesaFixaOcorrencia[]) ?? []}
      despesasVariaveis={despesasVariaveis}
      ocorrenciasVariaveis={(ocorrenciasVar as DespesaVariavelOcorrencia[]) ?? []}
      fornecedores={(fornecedores as Fornecedor[]) ?? []}
      atalhos={(atalhos as LancamentoAtalho[]) ?? []}
      lancamentos={(lancamentos as Lancamento[]) ?? []}
      servicos={(servicosRaw as ServicoParaVinculo[]) ?? []}
      ano={ano}
      mes={mes}
      geral={geral}
      abrirRecorrentes={params.abrir === "recorrentes"}
      secaoInicial={params.secao === "variaveis" ? "variaveis" : "fixas"}
    />
  );
}

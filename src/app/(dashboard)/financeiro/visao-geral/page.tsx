import { createClient } from "@/lib/supabase/server";
import { requireTab } from "@/lib/domain/permissions";
import { podeVerResultadoConsolidado } from "@/lib/domain/permissions";
import KpiCard from "@/components/hoje/KpiCard";
import ContasAPagarList from "@/components/financeiro/ContasAPagarList";
import DespesasAtrasadasList from "@/components/financeiro/DespesasAtrasadasList";
import ReceitasAtrasadasList from "@/components/financeiro/ReceitasAtrasadasList";
import VisaoGeralFinanceiroClient from "@/components/financeiro/VisaoGeralFinanceiroClient";
import { contasAPagar, despesasAtrasadas, receitasAtrasadas } from "@/lib/domain/dashboardMetrics";
import {
  aPagar,
  aReceber,
  despesasPagas,
  excluirPrevistosDeServicoCancelado,
  periodoDoMes,
  recebido,
  resultadoPendente,
  resultadoPrevistoFinal,
  resultadoRealizado,
  type IndicadorComVencidos,
  type IndicadorFinanceiro,
} from "@/lib/domain/financas";

/** Os cartões "Recebimentos vencidos"/"Despesas vencidas" mostram só o vencido, não o total do
 * período inteiro usado internamente pra encontrá-los — recalcula total/quantidade a partir da
 * sublista `vencidos`, sem inventar critério novo (a soma continua sendo a mesma função `Σ`). */
function comoIndicadorDeVencidos(ind: IndicadorComVencidos): IndicadorFinanceiro {
  const registros = ind.vencidos;
  return {
    ...ind,
    registros,
    total: registros.reduce((s, r) => s + r.valor, 0),
    quantidade: registros.length,
  };
}
import { FUSO_OPERACAO, hojeISOOperacao } from "@/lib/domain/dates";
import { resolverPeriodoDaUrl } from "@/lib/domain/periodoFinanceiro";
import type {
  Comprovante,
  DespesaFixa,
  DespesaFixaOcorrencia,
  DespesaVariavel,
  DespesaVariavelOcorrencia,
  Lancamento,
  Servico,
  ServicoParcela,
} from "@/lib/domain/types";

export default async function FinanceiroVisaoGeralPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string; mes?: string }>;
}) {
  const params = await searchParams;
  const profile = await requireTab("financeiro");
  const supabase = await createClient();
  const { ano, mes } = resolverPeriodoDaUrl(params);
  const hojeISO = hojeISOOperacao();
  const periodoMes = periodoDoMes(ano, mes, FUSO_OPERACAO);
  // Janela "aberta até hoje", sem início — usada só pra achar vencidos de qualquer mês
  // anterior, reaproveitando a mesma função `aReceber`/`aPagar` com outro período, nunca uma
  // fórmula nova.
  const periodoVencidos = { ano, mes, inicio: "2000-01-01", fim: hojeISO, timezone: FUSO_OPERACAO };

  let erro: string | null = null;
  let dados: {
    recebidoInd: ReturnType<typeof recebido>;
    despesasPagasInd: ReturnType<typeof despesasPagas>;
    aReceberMes: ReturnType<typeof aReceber>;
    aReceberVencidos: ReturnType<typeof aReceber>;
    aPagarMes: ReturnType<typeof aPagar>;
    despesasVencidasRegistros: { id: string; descricao: string; valor: number; data: string }[];
    resultadoRealizadoVal: number;
    resultadoPendenteVal: number;
    resultadoPrevistoFinalVal: number;
    vencemHoje: number;
    comprovantesPendentes: number;
    despesasFixasPagas: number;
    despesasFixasEmAberto: number;
    despesasVariaveisPagas: number;
    despesasVariaveisEmAberto: number;
    contas: ReturnType<typeof contasAPagar>;
    atrasadas: ReturnType<typeof despesasAtrasadas>;
    receitasAtrasadasList: ReturnType<typeof receitasAtrasadas>;
  } | null = null;

  try {
    const [
      { data: lancamentosDoMes, error: e1 },
      { data: lancamentosPrevistosRaw, error: e2 },
      { data: comprovantes, error: e3 },
      { data: despesas, error: e4 },
      { data: todasOcorrencias, error: e5 },
      { data: despesasVar, error: e6 },
      { data: todasOcorrenciasVar, error: e7 },
      { data: servicosCanceladosRaw, error: e8 },
      { data: parcelasAbertasRaw, error: e9 },
    ] = await Promise.all([
      supabase
        .from("lancamentos")
        .select("id, tipo, valor, status, data, descricao, servico_id")
        .eq("status", "realizado")
        .gte("data", periodoMes.inicio)
        .lte("data", periodoMes.fim),
      supabase
        .from("lancamentos")
        .select("id, tipo, valor, status, data, descricao, servico_id")
        .eq("status", "previsto"),
      supabase.from("comprovantes").select("status"),
      supabase.from("despesas_fixas").select("*").eq("ativo", true),
      supabase.from("despesas_fixas_ocorrencias").select("*").eq("pago", false),
      supabase.from("despesas_variaveis").select("*").eq("ativo", true),
      supabase.from("despesas_variaveis_ocorrencias").select("*").eq("pago", false),
      supabase.from("servicos").select("id, financeiro_status").eq("financeiro_status", "Cancelado"),
      supabase.from("servico_parcelas").select("*").is("cancelada_em", null),
    ]);
    const primeiroErro = [e1, e2, e3, e4, e5, e6, e7, e8, e9].find(Boolean);
    if (primeiroErro) throw primeiroErro;

    const servicosCancelados = (servicosCanceladosRaw as Pick<Servico, "id" | "financeiro_status">[]) ?? [];
    const lancamentosPrevistos = excluirPrevistosDeServicoCancelado(
      (lancamentosPrevistosRaw as Lancamento[]) ?? [],
      servicosCancelados
    );
    const parcelasAbertas = (parcelasAbertasRaw as ServicoParcela[]) ?? [];
    const servicosParaAReceber = servicosCancelados as unknown as Servico[];

    const despesasFixas = (despesas as DespesaFixa[]) ?? [];
    const ocorrenciasNaoPagas = (todasOcorrencias as DespesaFixaOcorrencia[]) ?? [];
    const ocorrenciasList = ocorrenciasNaoPagas.filter((o) => o.ano === ano && o.mes === mes);
    const despesasFixasEmAberto = despesasFixas.filter((d) => ocorrenciasList.some((o) => o.despesa_fixa_id === d.id)).length;
    const despesasFixasPagas = despesasFixas.length - despesasFixasEmAberto;

    const despesasVariaveis = (despesasVar as DespesaVariavel[]) ?? [];
    const ocorrenciasNaoPagasVar = (todasOcorrenciasVar as DespesaVariavelOcorrencia[]) ?? [];
    const ocorrenciasVarList = ocorrenciasNaoPagasVar.filter((o) => o.ano === ano && o.mes === mes);
    const despesasVariaveisEmAberto = despesasVariaveis.filter((d) =>
      ocorrenciasVarList.some((o) => o.despesa_variavel_id === d.id)
    ).length;
    const despesasVariaveisPagas = despesasVariaveis.length - despesasVariaveisEmAberto;

    const comprovantesPendentes = ((comprovantes as Pick<Comprovante, "status">[]) ?? []).filter(
      (c) => c.status === "pendente"
    ).length;

    const lancsReceitaPrevisto = lancamentosPrevistos.filter((l) => l.tipo === "Receita");
    const lancsDespesaPrevisto = lancamentosPrevistos.filter((l) => l.tipo === "Despesa");

    const recebidoInd = recebido((lancamentosDoMes as Lancamento[]) ?? [], periodoMes);
    const despesasPagasInd = despesasPagas((lancamentosDoMes as Lancamento[]) ?? [], periodoMes);
    const aReceberMes = aReceber(servicosParaAReceber, parcelasAbertas, lancsReceitaPrevisto, periodoMes, hojeISO);
    const aReceberVencidos = aReceber(servicosParaAReceber, parcelasAbertas, lancsReceitaPrevisto, periodoVencidos, hojeISO);
    const aPagarMes = aPagar(despesasFixas, ocorrenciasList, despesasVariaveis, ocorrenciasVarList, lancsDespesaPrevisto, periodoMes, hojeISO);

    const contas = contasAPagar(despesasFixas, ocorrenciasList, despesasVariaveis, ocorrenciasVarList, lancsDespesaPrevisto, hojeISO, {
      ano,
      mes,
    });
    const vencemHoje = contas.filter((c) => c.venceHoje).length;
    const atrasadas = despesasAtrasadas(despesasFixas, ocorrenciasNaoPagas, despesasVariaveis, ocorrenciasNaoPagasVar, ano, mes);
    const receitasAtrasadasList = receitasAtrasadas(lancsReceitaPrevisto, hojeISO);

    // "Despesas vencidas" precisa somar vencidos do mês selecionado (aPagarMes.vencidos) com
    // ocorrências de meses ANTERIORES ainda não pagas (`despesasAtrasadas`, já correto pra
    // isso) — `contasAPagar`/`aPagar` só enxergam 1 mês por chamada (ocorrência é por
    // ano/mês), então não dá pra pedir "todos os meses vencidos" numa chamada só.
    const despesasVencidasRegistros = [
      ...aPagarMes.vencidos,
      ...atrasadas.map((a) => ({
        id: a.ocorrenciaId,
        descricao: a.descricao,
        valor: a.valor,
        data: `${a.ano}-${String(a.mes).padStart(2, "0")}-01`,
      })),
    ];

    dados = {
      recebidoInd,
      despesasPagasInd,
      aReceberMes,
      aReceberVencidos,
      aPagarMes,
      despesasVencidasRegistros,
      resultadoRealizadoVal: resultadoRealizado(recebidoInd.total, despesasPagasInd.total),
      resultadoPendenteVal: resultadoPendente(aReceberMes.total, aPagarMes.total),
      resultadoPrevistoFinalVal: resultadoPrevistoFinal(recebidoInd.total, aReceberMes.total, despesasPagasInd.total, aPagarMes.total),
      vencemHoje,
      comprovantesPendentes,
      despesasFixasPagas,
      despesasFixasEmAberto,
      despesasVariaveisPagas,
      despesasVariaveisEmAberto,
      contas,
      atrasadas,
      receitasAtrasadasList,
    };
  } catch (err) {
    console.error("Falha ao carregar a Visão Geral do Financeiro", err);
    erro = err instanceof Error ? err.message : "Não foi possível carregar os indicadores financeiros.";
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-xl font-bold">Visão Geral do Financeiro</h1>
        <p className="text-[13px] text-text-secondary">
          Os indicadores oficiais do mês selecionado — clique num cartão pra ver os registros que o compõem
        </p>
      </div>

      <VisaoGeralFinanceiroClient
        erro={erro}
        ano={ano}
        mes={mes}
        podeVerResultado={podeVerResultadoConsolidado(profile.role)}
        dados={
          dados
            ? {
                recebido: dados.recebidoInd,
                despesasPagas: dados.despesasPagasInd,
                aReceber: dados.aReceberMes,
                recebimentosVencidos: comoIndicadorDeVencidos(dados.aReceberVencidos),
                aPagar: dados.aPagarMes,
                despesasVencidas: {
                  total: dados.despesasVencidasRegistros.reduce((s, r) => s + r.valor, 0),
                  quantidade: dados.despesasVencidasRegistros.length,
                  registros: dados.despesasVencidasRegistros,
                  periodo: { inicio: "", fim: hojeISO },
                  criterioData: "Vencimento (mês selecionado + ocorrências de meses anteriores ainda não pagas)",
                  statusConsiderados: ["não paga", "vencimento já passado"],
                  statusExcluidos: ["paga", "cancelada"],
                },
                resultadoRealizado: dados.resultadoRealizadoVal,
                resultadoPendente: dados.resultadoPendenteVal,
                resultadoPrevistoFinal: dados.resultadoPrevistoFinalVal,
              }
            : null
        }
      />

      {dados && (
        <>
          <div>
            <p className="mb-2 text-[10.5px] tracking-wide text-text-muted uppercase">Pendências</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label="Vencimentos Hoje" value={dados.vencemHoje} href="#contas-a-pagar" />
              <KpiCard label="Comprovantes Pendentes" value={dados.comprovantesPendentes} href="/financeiro/comprovantes" />
              <KpiCard
                label="Despesas Fixas"
                value={`${dados.despesasFixasPagas} pagas`}
                hint={`${dados.despesasFixasEmAberto} em aberto`}
                href="/financeiro/despesas?abrir=recorrentes&secao=fixas"
              />
              <KpiCard
                label="Despesas Variáveis"
                value={`${dados.despesasVariaveisPagas} pagas`}
                hint={`${dados.despesasVariaveisEmAberto} em aberto`}
                href="/financeiro/despesas?abrir=recorrentes&secao=variaveis"
              />
            </div>
          </div>

          <DespesasAtrasadasList itens={dados.atrasadas} />
          <ReceitasAtrasadasList itens={dados.receitasAtrasadasList} />

          <div id="contas-a-pagar">
            <ContasAPagarList itens={dados.contas} />
          </div>
        </>
      )}
    </div>
  );
}

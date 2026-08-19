import { createClient } from "@/lib/supabase/server";
import KpiCard from "@/components/hoje/KpiCard";
import ContasAPagarList from "@/components/financeiro/ContasAPagarList";
import { fmtBRL } from "@/lib/domain/types";
import { contasAPagar } from "@/lib/domain/dashboardMetrics";
import { todayISO } from "@/lib/domain/dates";
import type {
  Comprovante,
  DespesaFixa,
  DespesaFixaOcorrencia,
  DespesaVariavel,
  DespesaVariavelOcorrencia,
  Lancamento,
} from "@/lib/domain/types";

function noMes(dataISO: string, ano: number, mes: number) {
  const [y, m] = dataISO.split("-").map(Number);
  return y === ano && m === mes;
}

export default async function FinanceiroVisaoGeralPage() {
  const supabase = await createClient();
  const now = new Date();
  const ano = now.getFullYear();
  const mes = now.getMonth() + 1;
  const hojeISO = todayISO();

  const [
    { data: lancamentos },
    { data: comprovantes },
    { data: despesas },
    { data: ocorrencias },
    { data: despesasVar },
    { data: ocorrenciasVar },
    { data: osAprovadas },
  ] = await Promise.all([
    supabase.from("lancamentos").select("id, tipo, valor, status, data, descricao"),
    supabase.from("comprovantes").select("status"),
    supabase.from("despesas_fixas").select("*").eq("ativo", true),
    supabase.from("despesas_fixas_ocorrencias").select("*").eq("ano", ano).eq("mes", mes),
    supabase.from("despesas_variaveis").select("*").eq("ativo", true),
    supabase.from("despesas_variaveis_ocorrencias").select("*").eq("ano", ano).eq("mes", mes),
    supabase.from("servicos").select("valor, aprovado_em").not("numero", "is", null),
  ]);

  // Faturamento do mês = valor total das OS aprovadas (orçamento virou OS) dentro do mês
  // atual — independente de já ter sido pago ou não, é "o que foi vendido/fechado" no mês.
  const faturamentoMes = ((osAprovadas as { valor: number; aprovado_em: string | null }[]) ?? [])
    .filter((s) => s.aprovado_em && noMes(s.aprovado_em.slice(0, 10), ano, mes))
    .reduce((a, s) => a + s.valor, 0);

  const lancs = (lancamentos as Lancamento[]) ?? [];
  const lancsDoMes = lancs.filter((l) => noMes(l.data, ano, mes));

  // Realizado (mês) — dinheiro que já entrou/saiu de fato este mês.
  const realizadosMes = lancsDoMes.filter((l) => l.status === "realizado");
  const receitaRealizada = realizadosMes.filter((l) => l.tipo === "Receita").reduce((a, l) => a + l.valor, 0);
  const despesaRealizada = realizadosMes.filter((l) => l.tipo === "Despesa").reduce((a, l) => a + l.valor, 0);
  const fluxoCaixa = receitaRealizada - despesaRealizada;

  // Previsto (mês) — parcelas a receber e despesas a pagar que ainda vão vencer este mês.
  const previstosMes = lancsDoMes.filter((l) => l.status === "previsto");
  const receitaPrevista = previstosMes.filter((l) => l.tipo === "Receita").reduce((a, l) => a + l.valor, 0);
  const despesaPrevistaLancamentos = previstosMes.filter((l) => l.tipo === "Despesa").reduce((a, l) => a + l.valor, 0);

  const despesasFixas = (despesas as DespesaFixa[]) ?? [];
  const ocorrenciasList = (ocorrencias as DespesaFixaOcorrencia[]) ?? [];
  const pagas = new Set(ocorrenciasList.filter((o) => o.pago).map((o) => o.despesa_fixa_id));
  const despesasFixasPagas = despesasFixas.filter((d) => pagas.has(d.id)).length;
  const despesasFixasEmAberto = despesasFixas.filter((d) => !pagas.has(d.id)).length;
  const despesasFixasEmAbertoValor = despesasFixas
    .filter((d) => !pagas.has(d.id))
    .reduce((a, d) => a + d.valor, 0);

  const despesasVariaveis = (despesasVar as DespesaVariavel[]) ?? [];
  const ocorrenciasVarList = (ocorrenciasVar as DespesaVariavelOcorrencia[]) ?? [];
  const pagasVar = new Set(ocorrenciasVarList.filter((o) => o.pago).map((o) => o.despesa_variavel_id));
  const despesasVariaveisPagas = despesasVariaveis.filter((d) => pagasVar.has(d.id)).length;
  const despesasVariaveisEmAberto = despesasVariaveis.filter((d) => !pagasVar.has(d.id)).length;
  const despesasVariaveisEmAbertoValor = despesasVariaveis
    .filter((d) => !pagasVar.has(d.id))
    .reduce((a, d) => {
      const ocorrencia = ocorrenciasVarList.find((o) => o.despesa_variavel_id === d.id);
      return a + (ocorrencia?.valor_real ?? d.valor_provisionado);
    }, 0);

  // Despesa prevista (mês) = lançamentos previstos + despesas fixas/variáveis ainda não pagas —
  // mesmas fontes da lista "Contas a Pagar" abaixo, somadas pra virar um número só.
  const despesaPrevista = despesaPrevistaLancamentos + despesasFixasEmAbertoValor + despesasVariaveisEmAbertoValor;

  const lucroPrevisto = receitaRealizada + receitaPrevista - (despesaRealizada + despesaPrevista);

  const comprovantesPendentes = ((comprovantes as Pick<Comprovante, "status">[]) ?? []).filter(
    (c) => c.status === "pendente"
  ).length;

  const contas = contasAPagar(
    despesasFixas,
    ocorrenciasList,
    despesasVariaveis,
    ocorrenciasVarList,
    lancs,
    hojeISO
  );
  const vencemHoje = contas.filter((c) => c.venceHoje).length;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-xl font-bold">Visão Geral</h1>
        <p className="text-[13px] text-text-secondary">Receitas, despesas e pendências do mês</p>
      </div>

      <div>
        <p className="mb-2 text-[10.5px] tracking-wide text-text-muted uppercase">Realizado no mês</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Faturamento do Mês"
            value={fmtBRL(faturamentoMes)}
            hint="Valor das OS aprovadas este mês"
          />
          <KpiCard label="Receita Realizada" value={fmtBRL(receitaRealizada)} />
          <KpiCard label="Despesa Realizada" value={fmtBRL(despesaRealizada)} />
          <KpiCard label="Fluxo de Caixa" value={fmtBRL(fluxoCaixa)} gold />
        </div>
      </div>

      <div>
        <p className="mb-2 text-[10.5px] tracking-wide text-text-muted uppercase">Previsto pro mês</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KpiCard
            label="Receita Prevista"
            value={fmtBRL(receitaPrevista)}
            hint="Parcelas a receber este mês"
          />
          <KpiCard
            label="Despesa Prevista"
            value={fmtBRL(despesaPrevista)}
            hint="Contas a pagar este mês"
          />
          <KpiCard
            label="Lucro Previsto"
            value={fmtBRL(lucroPrevisto)}
            hint="Se tudo entrar/sair como combinado"
            gold
          />
        </div>
      </div>

      <div>
        <p className="mb-2 text-[10.5px] tracking-wide text-text-muted uppercase">Pendências</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Vencimentos Hoje" value={vencemHoje} />
          <KpiCard label="Comprovantes Pendentes" value={comprovantesPendentes} />
          <KpiCard
            label="Despesas Fixas"
            value={`${despesasFixasPagas} pagas`}
            hint={`${despesasFixasEmAberto} em aberto`}
          />
          <KpiCard
            label="Despesas Variáveis"
            value={`${despesasVariaveisPagas} pagas`}
            hint={`${despesasVariaveisEmAberto} em aberto`}
          />
        </div>
      </div>

      <ContasAPagarList itens={contas} />
    </div>
  );
}

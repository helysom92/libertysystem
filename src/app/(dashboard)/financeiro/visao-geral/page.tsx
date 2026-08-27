import { createClient } from "@/lib/supabase/server";
import KpiCard from "@/components/hoje/KpiCard";
import ContasAPagarList from "@/components/financeiro/ContasAPagarList";
import DespesasAtrasadasList from "@/components/financeiro/DespesasAtrasadasList";
import ReceitasAtrasadasList from "@/components/financeiro/ReceitasAtrasadasList";
import { contasAPagar, despesasAtrasadas, receitasAtrasadas } from "@/lib/domain/dashboardMetrics";
import { excluirPrevistosDeServicoCancelado } from "@/lib/domain/financas";
import { todayISO } from "@/lib/domain/dates";
import type {
  Comprovante,
  DespesaFixa,
  DespesaFixaOcorrencia,
  DespesaVariavel,
  DespesaVariavelOcorrencia,
  Lancamento,
  Servico,
} from "@/lib/domain/types";

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
    { data: todasOcorrencias },
    { data: despesasVar },
    { data: todasOcorrenciasVar },
    { data: servicosCancelados },
  ] = await Promise.all([
    supabase.from("lancamentos").select("id, tipo, valor, status, data, descricao, servico_id"),
    supabase.from("comprovantes").select("status"),
    supabase.from("despesas_fixas").select("*").eq("ativo", true),
    supabase.from("despesas_fixas_ocorrencias").select("*").eq("pago", false),
    supabase.from("despesas_variaveis").select("*").eq("ativo", true),
    supabase.from("despesas_variaveis_ocorrencias").select("*").eq("pago", false),
    supabase.from("servicos").select("id, financeiro_status").eq("financeiro_status", "Cancelado"),
  ]);

  // Lançamento previsto de um serviço Cancelado nunca vai virar dinheiro de verdade — sai das
  // pendências (dinheiro já realizado antes do cancelamento continua contando em outro lugar).
  const lancs = excluirPrevistosDeServicoCancelado(
    (lancamentos as Lancamento[]) ?? [],
    (servicosCancelados as Pick<Servico, "id" | "financeiro_status">[]) ?? []
  );

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

  const contas = contasAPagar(
    despesasFixas,
    ocorrenciasList,
    despesasVariaveis,
    ocorrenciasVarList,
    lancs,
    hojeISO
  );
  const vencemHoje = contas.filter((c) => c.venceHoje).length;

  const atrasadas = despesasAtrasadas(
    despesasFixas,
    ocorrenciasNaoPagas,
    despesasVariaveis,
    ocorrenciasNaoPagasVar,
    ano,
    mes
  );

  const receitasAtrasadasList = receitasAtrasadas(lancs, hojeISO);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-xl font-bold">Pendências do Mês</h1>
        <p className="text-[13px] text-text-secondary">
          O que precisa de atenção agora — receita, despesa e lucro ficam em Gestão
        </p>
      </div>

      <div>
        <p className="mb-2 text-[10.5px] tracking-wide text-text-muted uppercase">Pendências</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Vencimentos Hoje" value={vencemHoje} href="#contas-a-pagar" />
          <KpiCard
            label="Comprovantes Pendentes"
            value={comprovantesPendentes}
            href="/financeiro/comprovantes"
          />
          <KpiCard
            label="Despesas Fixas"
            value={`${despesasFixasPagas} pagas`}
            hint={`${despesasFixasEmAberto} em aberto`}
            href="/financeiro/despesas?abrir=recorrentes&secao=fixas"
          />
          <KpiCard
            label="Despesas Variáveis"
            value={`${despesasVariaveisPagas} pagas`}
            hint={`${despesasVariaveisEmAberto} em aberto`}
            href="/financeiro/despesas?abrir=recorrentes&secao=variaveis"
          />
        </div>
      </div>

      <DespesasAtrasadasList itens={atrasadas} />
      <ReceitasAtrasadasList itens={receitasAtrasadasList} />

      <div id="contas-a-pagar">
        <ContasAPagarList itens={contas} />
      </div>
    </div>
  );
}

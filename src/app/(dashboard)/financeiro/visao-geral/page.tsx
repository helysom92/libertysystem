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
  ] = await Promise.all([
    supabase.from("lancamentos").select("id, tipo, valor, status, data, descricao"),
    supabase.from("comprovantes").select("status"),
    supabase.from("despesas_fixas").select("*").eq("ativo", true),
    supabase.from("despesas_fixas_ocorrencias").select("*").eq("ano", ano).eq("mes", mes),
    supabase.from("despesas_variaveis").select("*").eq("ativo", true),
    supabase.from("despesas_variaveis_ocorrencias").select("*").eq("ano", ano).eq("mes", mes),
  ]);

  const lancs = (lancamentos as Lancamento[]) ?? [];
  const realizados = lancs.filter((l) => l.status === "realizado");
  const receitas = realizados.filter((l) => l.tipo === "Receita").reduce((a, l) => a + l.valor, 0);
  const despesasTotal = realizados.filter((l) => l.tipo === "Despesa").reduce((a, l) => a + l.valor, 0);
  const fluxoCaixa = receitas - despesasTotal;

  const comprovantesPendentes = ((comprovantes as Pick<Comprovante, "status">[]) ?? []).filter(
    (c) => c.status === "pendente"
  ).length;

  const despesasFixas = (despesas as DespesaFixa[]) ?? [];
  const ocorrenciasList = (ocorrencias as DespesaFixaOcorrencia[]) ?? [];
  const pagas = new Set(ocorrenciasList.filter((o) => o.pago).map((o) => o.despesa_fixa_id));
  const despesasFixasEmAberto = despesasFixas.filter((d) => !pagas.has(d.id)).length;

  const despesasVariaveis = (despesasVar as DespesaVariavel[]) ?? [];
  const ocorrenciasVarList = (ocorrenciasVar as DespesaVariavelOcorrencia[]) ?? [];
  const pagasVar = new Set(ocorrenciasVarList.filter((o) => o.pago).map((o) => o.despesa_variavel_id));
  const despesasVariaveisEmAberto = despesasVariaveis.filter((d) => !pagasVar.has(d.id)).length;

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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Receitas" value={fmtBRL(receitas)} />
        <KpiCard label="Despesas" value={fmtBRL(despesasTotal)} />
        <KpiCard label="Fluxo de Caixa" value={fmtBRL(fluxoCaixa)} gold />
        <KpiCard label="Vencimentos Hoje" value={vencemHoje} />
        <KpiCard label="Comprovantes Pendentes" value={comprovantesPendentes} />
        <KpiCard label="Despesas Fixas em Aberto" value={despesasFixasEmAberto} />
        <KpiCard label="Despesas Variáveis em Aberto" value={despesasVariaveisEmAberto} />
      </div>
      <ContasAPagarList itens={contas} />
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { requireHelysom } from "@/lib/domain/permissions";
import { resolverPeriodoDaUrl } from "@/lib/domain/periodoFinanceiro";
import { periodoDoMes } from "@/lib/domain/financas";
import { hojeISOOperacao } from "@/lib/domain/dates";
import {
  receitasRecebidasNoMes,
  despesasPagasNoMes,
  receitasPrevistasEmAberto,
  compromissosAPagar,
  resultadoCaixaRealizadoPessoal,
  saldoDisponivelTotal,
} from "@/lib/domain/financasPessoais";
import type {
  ContaPessoal,
  ReceitaPessoal,
  DespesaPessoal,
  TransferenciaPessoal,
  MovimentoInvestimentoPessoal,
} from "@/lib/domain/types";
import VisaoGeralPessoalClient from "@/components/financas-pessoais/VisaoGeralPessoalClient";
import ErroConsulta from "@/components/financeiro/ErroConsulta";

export default async function VisaoGeralPessoalPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string; mes?: string }>;
}) {
  const profile = await requireHelysom();
  const supabase = await createClient();
  const params = await searchParams;
  const { ano, mes } = resolverPeriodoDaUrl(params);
  const periodo = periodoDoMes(ano, mes);
  const hoje = hojeISOOperacao();

  let erro: string | null = null;
  let dados: ReturnType<typeof montarDados> | null = null;

  try {
    const [
      { data: contasRaw, error: e1 },
      { data: receitasRaw, error: e2 },
      { data: despesasRaw, error: e3 },
      { data: transfRaw, error: e4 },
      { data: movimentosInvRaw, error: e5 },
    ] = await Promise.all([
      supabase.from("contas_pessoais").select("*").eq("owner_id", profile.id),
      supabase.from("receitas_pessoais").select("*").eq("owner_id", profile.id),
      supabase.from("despesas_pessoais").select("*").eq("owner_id", profile.id),
      supabase.from("transferencias_pessoais").select("*").eq("owner_id", profile.id),
      supabase.from("movimentos_investimento_pessoal").select("*").eq("owner_id", profile.id),
    ]);
    const primeiroErro = e1 ?? e2 ?? e3 ?? e4 ?? e5;
    if (primeiroErro) throw primeiroErro;

    const contas = (contasRaw as ContaPessoal[]) ?? [];
    const receitas = (receitasRaw as ReceitaPessoal[]) ?? [];
    const despesas = (despesasRaw as DespesaPessoal[]) ?? [];
    const transferencias = (transfRaw as TransferenciaPessoal[]) ?? [];
    const movimentosInvestimento = (movimentosInvRaw as MovimentoInvestimentoPessoal[]) ?? [];

    dados = montarDados(contas, receitas, despesas, transferencias, movimentosInvestimento, periodo, hoje);
  } catch (err) {
    console.error("Falha ao carregar Visão Geral (Finanças Pessoais)", err);
    erro = err instanceof Error ? err.message : "erro desconhecido";
  }

  if (erro) return <ErroConsulta mensagem={erro} />;

  return <VisaoGeralPessoalClient dados={dados} ano={ano} mes={mes} />;
}

function montarDados(
  contas: ContaPessoal[],
  receitas: ReceitaPessoal[],
  despesas: DespesaPessoal[],
  transferencias: TransferenciaPessoal[],
  movimentosInvestimento: MovimentoInvestimentoPessoal[],
  periodo: ReturnType<typeof periodoDoMes>,
  hoje: string
) {
  const recebido = receitasRecebidasNoMes(receitas, periodo);
  const pago = despesasPagasNoMes(despesas, periodo);
  const aReceber = receitasPrevistasEmAberto(receitas, periodo, hoje);
  const aPagar = compromissosAPagar(despesas, periodo, hoje);
  return {
    recebido,
    pago,
    aReceber,
    aPagar,
    resultadoRealizado: resultadoCaixaRealizadoPessoal(recebido.total, pago.total),
    saldoDisponivel: saldoDisponivelTotal(contas, receitas, despesas, transferencias, movimentosInvestimento),
    contasComSaldoConhecido: contas.some((c) => c.ativa),
  };
}

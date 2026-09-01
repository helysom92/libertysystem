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
  totalInvestidoGeral,
  saldoDevedorTotal,
  totalFaturasEmAberto,
  patrimonioLiquido,
} from "@/lib/domain/financasPessoais";
import type {
  ContaPessoal,
  ReceitaPessoal,
  DespesaPessoal,
  TransferenciaPessoal,
  MovimentoInvestimentoPessoal,
  CartaoPessoal,
  CompraCartaoPessoal,
  DividaPessoal,
  PagamentoDividaPessoal,
  InvestimentoPessoal,
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
      { data: cartoesRaw, error: e6 },
      { data: comprasRaw, error: e7 },
      { data: dividasRaw, error: e8 },
      { data: pagamentosDividaRaw, error: e9 },
      { data: investimentosRaw, error: e10 },
    ] = await Promise.all([
      supabase.from("contas_pessoais").select("*").eq("owner_id", profile.id),
      supabase.from("receitas_pessoais").select("*").eq("owner_id", profile.id),
      supabase.from("despesas_pessoais").select("*").eq("owner_id", profile.id),
      supabase.from("transferencias_pessoais").select("*").eq("owner_id", profile.id),
      supabase.from("movimentos_investimento_pessoal").select("*").eq("owner_id", profile.id),
      supabase.from("cartoes_pessoais").select("*").eq("owner_id", profile.id),
      supabase.from("compras_cartao_pessoal").select("*").eq("owner_id", profile.id),
      supabase.from("dividas_pessoais").select("*").eq("owner_id", profile.id),
      supabase.from("pagamentos_divida_pessoal").select("*").eq("owner_id", profile.id),
      supabase.from("investimentos_pessoais").select("*").eq("owner_id", profile.id),
    ]);
    const primeiroErro = e1 ?? e2 ?? e3 ?? e4 ?? e5 ?? e6 ?? e7 ?? e8 ?? e9 ?? e10;
    if (primeiroErro) throw primeiroErro;

    const contas = (contasRaw as ContaPessoal[]) ?? [];
    const receitas = (receitasRaw as ReceitaPessoal[]) ?? [];
    const despesas = (despesasRaw as DespesaPessoal[]) ?? [];
    const transferencias = (transfRaw as TransferenciaPessoal[]) ?? [];
    const movimentosInvestimento = (movimentosInvRaw as MovimentoInvestimentoPessoal[]) ?? [];
    const cartoes = (cartoesRaw as CartaoPessoal[]) ?? [];
    const compras = (comprasRaw as CompraCartaoPessoal[]) ?? [];
    const dividas = (dividasRaw as DividaPessoal[]) ?? [];
    const pagamentosDivida = (pagamentosDividaRaw as PagamentoDividaPessoal[]) ?? [];
    const investimentos = (investimentosRaw as InvestimentoPessoal[]) ?? [];

    dados = montarDados(
      contas,
      receitas,
      despesas,
      transferencias,
      movimentosInvestimento,
      cartoes,
      compras,
      dividas,
      pagamentosDivida,
      investimentos,
      periodo,
      hoje
    );
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
  cartoes: CartaoPessoal[],
  compras: CompraCartaoPessoal[],
  dividas: DividaPessoal[],
  pagamentosDivida: PagamentoDividaPessoal[],
  investimentos: InvestimentoPessoal[],
  periodo: ReturnType<typeof periodoDoMes>,
  hoje: string
) {
  const recebido = receitasRecebidasNoMes(receitas, periodo);
  const pago = despesasPagasNoMes(despesas, periodo);
  const aReceber = receitasPrevistasEmAberto(receitas, periodo, hoje);
  const aPagar = compromissosAPagar(despesas, periodo, hoje);

  const saldoDisponivel = saldoDisponivelTotal(contas, receitas, despesas, transferencias, movimentosInvestimento);
  const totalInvestido = totalInvestidoGeral(investimentos, movimentosInvestimento);
  const totalDividas = saldoDevedorTotal(dividas, pagamentosDivida);
  const faturasEmAberto = totalFaturasEmAberto(cartoes, compras, despesas);

  return {
    recebido,
    pago,
    aReceber,
    aPagar,
    resultadoRealizado: resultadoCaixaRealizadoPessoal(recebido.total, pago.total),
    saldoDisponivel,
    contasComSaldoConhecido: contas.some((c) => c.ativa),
    totalInvestido,
    totalDividas,
    faturasEmAberto,
    patrimonioLiquido: patrimonioLiquido(saldoDisponivel, totalInvestido, totalDividas, faturasEmAberto),
  };
}

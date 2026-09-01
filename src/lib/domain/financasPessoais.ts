import type { PeriodoFiltro, IndicadorFinanceiro, RegistroIndicador } from "./financas";
import type {
  ContaPessoal,
  ReceitaPessoal,
  DespesaPessoal,
  TransferenciaPessoal,
  SituacaoReceitaPessoal,
  SituacaoDespesaPessoal,
  CartaoPessoal,
  CompraCartaoPessoal,
  DividaPessoal,
  PagamentoDividaPessoal,
  SituacaoDividaPessoal,
  InvestimentoPessoal,
  MovimentoInvestimentoPessoal,
} from "./types";

/**
 * Camada de regras financeiras do módulo Finanças Pessoais — funções puras, mesmo padrão de
 * `financas.ts` (Etapa 2), mas isolada dele: nunca importa nem altera nada do domínio
 * empresarial, e vice-versa. Reaproveita só os TIPOS de envelope (`IndicadorFinanceiro`,
 * `PeriodoFiltro`), não dado nem cálculo.
 */

// ── Receitas recebidas / despesas pagas no mês (regime de caixa, mesma regra do lado empresarial) ──

export function receitasRecebidasNoMes(receitas: ReceitaPessoal[], periodo: PeriodoFiltro): IndicadorFinanceiro {
  const registros: RegistroIndicador[] = receitas
    .filter((r) => r.data_efetiva && r.data_efetiva >= periodo.inicio && r.data_efetiva <= periodo.fim && r.valor_recebido > 0)
    .map((r) => ({ id: r.id, descricao: r.descricao, valor: r.valor_recebido, data: r.data_efetiva! }));
  return {
    total: registros.reduce((s, r) => s + r.valor, 0),
    quantidade: registros.length,
    registros,
    periodo: { inicio: periodo.inicio, fim: periodo.fim },
    criterioData: "Data efetiva do recebimento (receitas_pessoais.data_efetiva)",
    statusConsiderados: ["parcial", "recebida"],
    statusExcluidos: ["prevista", "cancelada"],
  };
}

export function despesasPagasNoMes(despesas: DespesaPessoal[], periodo: PeriodoFiltro): IndicadorFinanceiro {
  const registros: RegistroIndicador[] = despesas
    .filter((d) => d.data_efetiva && d.data_efetiva >= periodo.inicio && d.data_efetiva <= periodo.fim && d.valor_pago > 0)
    .map((d) => ({ id: d.id, descricao: d.descricao, valor: d.valor_pago, data: d.data_efetiva! }));
  return {
    total: registros.reduce((s, r) => s + r.valor, 0),
    quantidade: registros.length,
    registros,
    periodo: { inicio: periodo.inicio, fim: periodo.fim },
    criterioData: "Data efetiva do pagamento (despesas_pessoais.data_efetiva)",
    statusConsiderados: ["parcial", "paga"],
    statusExcluidos: ["prevista", "cancelada"],
  };
}

// ── Receitas previstas em aberto / compromissos a pagar (saldo restante, por vencimento) ──

export interface IndicadorComVencidosPessoal extends IndicadorFinanceiro {
  vencidos: RegistroIndicador[];
}

export function receitasPrevistasEmAberto(
  receitas: ReceitaPessoal[],
  periodo: PeriodoFiltro,
  hojeISO: string
): IndicadorComVencidosPessoal {
  const itens = receitas
    .filter((r) => r.situacao !== "cancelada" && r.situacao !== "recebida")
    .map((r) => ({
      id: r.id,
      descricao: r.descricao,
      valor: Math.max(0, r.valor_previsto - r.valor_recebido),
      data: r.data_prevista,
      vencido: !!r.data_prevista && r.data_prevista < hojeISO,
    }))
    .filter((r) => r.valor > 0 && r.data && r.data >= periodo.inicio && r.data <= periodo.fim) as (RegistroIndicador & {
    vencido: boolean;
  })[];

  const toRegistro = (r: (typeof itens)[number]): RegistroIndicador => ({ id: r.id, descricao: r.descricao, valor: r.valor, data: r.data });
  return {
    total: itens.reduce((s, r) => s + r.valor, 0),
    quantidade: itens.length,
    registros: itens.map(toRegistro),
    periodo: { inicio: periodo.inicio, fim: periodo.fim },
    criterioData: "Data prevista do recebimento (receitas_pessoais.data_prevista)",
    statusConsiderados: ["prevista", "parcial"],
    statusExcluidos: ["recebida", "cancelada"],
    vencidos: itens.filter((r) => r.vencido).map(toRegistro),
  };
}

export function compromissosAPagar(
  despesas: DespesaPessoal[],
  periodo: PeriodoFiltro,
  hojeISO: string
): IndicadorComVencidosPessoal {
  const itens = despesas
    .filter((d) => d.situacao !== "cancelada" && d.situacao !== "paga")
    .map((d) => ({
      id: d.id,
      descricao: d.descricao,
      valor: Math.max(0, d.valor_previsto - d.valor_pago),
      data: d.vencimento,
      vencido: !!d.vencimento && d.vencimento < hojeISO,
    }))
    .filter((d) => d.valor > 0 && d.data && d.data >= periodo.inicio && d.data <= periodo.fim) as (RegistroIndicador & {
    vencido: boolean;
  })[];

  const toRegistro = (r: (typeof itens)[number]): RegistroIndicador => ({ id: r.id, descricao: r.descricao, valor: r.valor, data: r.data });
  return {
    total: itens.reduce((s, r) => s + r.valor, 0),
    quantidade: itens.length,
    registros: itens.map(toRegistro),
    periodo: { inicio: periodo.inicio, fim: periodo.fim },
    criterioData: "Data de vencimento (despesas_pessoais.vencimento)",
    statusConsiderados: ["prevista", "parcial"],
    statusExcluidos: ["paga", "cancelada"],
    vencidos: itens.filter((r) => r.vencido).map(toRegistro),
  };
}

// ── Resultado de caixa realizado no mês (recebido − pago, nunca chamado de "lucro") ──
export function resultadoCaixaRealizadoPessoal(recebidoTotal: number, pagoTotal: number): number {
  return recebidoTotal - pagoTotal;
}

// ── Saldo de uma conta: saldo inicial + movimentações com data >= data do saldo inicial ──
// Nunca soma de novo o que já está refletido no saldo inicial informado, e nunca conta limite
// de cartão como saldo disponível (regra explícita do pedido). Aporte/resgate de investimento
// (Bloco D) SÃO refletidos aqui quando têm `conta_id` — é dinheiro real saindo/voltando da
// conta bancária, mesmo que o valor investido em si não conte como saldo disponível.
export function saldoConta(
  conta: ContaPessoal,
  receitas: ReceitaPessoal[],
  despesas: DespesaPessoal[],
  transferencias: TransferenciaPessoal[],
  movimentosInvestimento: MovimentoInvestimentoPessoal[] = []
): number {
  let saldo = conta.saldo_inicial;

  for (const r of receitas) {
    if (r.conta_destino_id !== conta.id || !r.data_efetiva) continue;
    if (r.data_efetiva < conta.data_saldo_inicial) continue;
    saldo += r.valor_recebido;
  }
  for (const d of despesas) {
    if (d.conta_id !== conta.id || !d.data_efetiva) continue;
    if (d.data_efetiva < conta.data_saldo_inicial) continue;
    saldo -= d.valor_pago;
  }
  for (const t of transferencias) {
    if (t.data < conta.data_saldo_inicial) continue;
    if (t.conta_origem_id === conta.id) saldo -= t.valor + t.tarifa;
    if (t.conta_destino_id === conta.id) saldo += t.valor;
  }
  for (const m of movimentosInvestimento) {
    if (m.conta_id !== conta.id || m.estornado_em) continue;
    if (m.data < conta.data_saldo_inicial) continue;
    if (m.tipo === "aporte") saldo -= m.valor;
    else if (m.tipo === "resgate") saldo += m.valor;
    // 'rendimento' nunca mexe em conta — fica dentro do investimento até um resgate futuro.
  }

  return saldo;
}

/** Soma o saldo de todas as contas ativas — "Saldo disponível nas contas" da Visão Geral. Nunca
 * inclui limite de cartão nem valor investido em si (só o que efetivamente saiu/voltou da
 * conta via aporte/resgate). */
export function saldoDisponivelTotal(
  contas: ContaPessoal[],
  receitas: ReceitaPessoal[],
  despesas: DespesaPessoal[],
  transferencias: TransferenciaPessoal[],
  movimentosInvestimento: MovimentoInvestimentoPessoal[] = []
): number {
  return contas
    .filter((c) => c.ativa)
    .reduce((soma, c) => soma + saldoConta(c, receitas, despesas, transferencias, movimentosInvestimento), 0);
}

// ── Situação, pro mesmo padrão de badge usado no lado empresarial (situacaoLancamento) ──
export type SituacaoObrigacaoPessoal = "prevista" | "parcial" | "quitada" | "a_vencer" | "vencida" | "cancelada";

export function situacaoObrigacaoPessoal(
  situacao: SituacaoReceitaPessoal | SituacaoDespesaPessoal,
  dataReferencia: string | null,
  hojeISO: string
): SituacaoObrigacaoPessoal {
  if (situacao === "cancelada") return "cancelada";
  if (situacao === "parcial") return "parcial";
  if (situacao === "recebida" || situacao === "paga") return "quitada";
  if (!dataReferencia) return "a_vencer";
  return dataReferencia < hojeISO ? "vencida" : "a_vencer";
}

// ── Bloco C: cartões, faturas e dívidas ──────────────────────────────────────────────────────

export interface FaturaChave {
  ano: number;
  mes: number; // 1-12
}

/** Em qual fatura (ano/mês) a PRIMEIRA parcela de uma compra cai, dado o dia de fechamento do
 * cartão — compra até o fechamento entra na fatura do mesmo mês, depois do fechamento rola pra
 * fatura do mês seguinte. Regra simplificada (informativa, não replica exatamente o cronograma
 * de cada banco). */
export function calcularFaturaDaCompra(dataCompraISO: string, diaFechamento: number): FaturaChave {
  const [anoStr, mesStr, diaStr] = dataCompraISO.split("-");
  let ano = Number(anoStr);
  let mes = Number(mesStr); // 1-12
  const dia = Number(diaStr);
  if (dia > diaFechamento) {
    mes += 1;
    if (mes > 12) {
      mes = 1;
      ano += 1;
    }
  }
  return { ano, mes };
}

export interface ParcelaCompraGerada {
  numero: number;
  valor: number;
  ano: number;
  mes: number;
}

/** Divide uma compra em N parcelas iguais (resto de centavos vai pra última, pra soma bater
 * exatamente com o valor total) — cada uma na fatura sucessiva a partir da primeira. */
export function gerarParcelasCompra(
  dataCompraISO: string,
  diaFechamento: number,
  valorTotal: number,
  parcelasTotal: number
): ParcelaCompraGerada[] {
  const primeira = calcularFaturaDaCompra(dataCompraISO, diaFechamento);
  const valorBase = Math.floor((valorTotal / parcelasTotal) * 100) / 100;
  const resto = Math.round((valorTotal - valorBase * parcelasTotal) * 100) / 100;

  const parcelas: ParcelaCompraGerada[] = [];
  let { ano, mes } = primeira;
  for (let i = 1; i <= parcelasTotal; i++) {
    const valor = i === parcelasTotal ? Math.round((valorBase + resto) * 100) / 100 : valorBase;
    parcelas.push({ numero: i, valor, ano, mes });
    mes += 1;
    if (mes > 12) {
      mes = 1;
      ano += 1;
    }
  }
  return parcelas;
}

/** Soma das parcelas não canceladas de um cartão numa fatura (ano/mês) — é o valor "a lançar"
 * como despesa quando a fatura for paga. */
export function totalFaturaAberta(compras: CompraCartaoPessoal[], cartaoId: string, ano: number, mes: number): number {
  return compras
    .filter((c) => c.cartao_id === cartaoId && c.fatura_ano === ano && c.fatura_mes === mes && !c.cancelada_em)
    .reduce((s, c) => s + c.valor_parcela, 0);
}

function faturaKey(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

/** Data de vencimento da fatura de um cartão num ano/mês — se o dia de vencimento é ANTES do
 * dia de fechamento (padrão mais comum: fecha no fim do mês, vence no começo do seguinte), a
 * data de vencimento cai no mês SEGUINTE ao mês da fatura; senão, no mesmo mês. */
export function vencimentoDaFatura(ano: number, mes: number, diaFechamento: number, diaVencimento: number): string {
  let anoVenc = ano;
  let mesVenc = mes;
  if (diaVencimento < diaFechamento) {
    mesVenc += 1;
    if (mesVenc > 12) {
      mesVenc = 1;
      anoVenc += 1;
    }
  }
  return `${anoVenc}-${String(mesVenc).padStart(2, "0")}-${String(diaVencimento).padStart(2, "0")}`;
}

/** Limite consumido: soma das parcelas não canceladas cuja fatura ainda não foi paga — uma vez
 * que a fatura é paga (despesa vinculada com situação "paga"), o limite dela é liberado, mesmo
 * que a compra continue no histórico. `faturasPagas` é o conjunto de "ano-mês" já quitados. */
export function limiteUsado(
  cartaoId: string,
  compras: CompraCartaoPessoal[],
  faturasPagas: Set<string>
): number {
  return compras
    .filter((c) => c.cartao_id === cartaoId && !c.cancelada_em && !faturasPagas.has(faturaKey(c.fatura_ano, c.fatura_mes)))
    .reduce((s, c) => s + c.valor_parcela, 0);
}

export function limiteDisponivel(cartao: CartaoPessoal, valorUsado: number): number | null {
  if (cartao.limite == null) return null;
  return cartao.limite - valorUsado;
}

export type SituacaoFaturaPessoal = "sem_compras" | "nao_lancada" | SituacaoDespesaPessoal;

/** Situação de exibição de UMA fatura (cartão + ano/mês): sem nenhuma compra, com compras mas
 * ainda não lançada como despesa, ou a situação da despesa já lançada (prevista/parcial/paga/
 * cancelada) — nunca inventa um segundo status paralelo ao da despesa. */
export function situacaoFatura(despesaVinculada: DespesaPessoal | null, totalCompras: number): SituacaoFaturaPessoal {
  if (despesaVinculada) return despesaVinculada.situacao;
  return totalCompras > 0 ? "nao_lancada" : "sem_compras";
}

// ── Dívidas — saldo sempre derivado do ledger (mesmo padrão de `saldoConta`), nunca uma coluna
// mutável recalculada na mão. `saldo_inicial` é o saldo devedor no momento do CADASTRO, não o
// valor original do empréstimo (pedido explícito: não reconstrói o passado inteiro). ──

export function saldoDivida(divida: DividaPessoal, pagamentosDaDivida: PagamentoDividaPessoal[]): number {
  const pago = pagamentosDaDivida
    .filter((p) => p.divida_id === divida.id && !p.estornado_em)
    .reduce((s, p) => s + p.valor, 0);
  return Math.max(0, divida.saldo_inicial - pago);
}

export function parcelasRestantesAtual(divida: DividaPessoal, pagamentosDaDivida: PagamentoDividaPessoal[]): number | null {
  if (divida.parcelas_restantes_inicial == null) return null;
  const quantidadePaga = pagamentosDaDivida.filter((p) => p.divida_id === divida.id && !p.estornado_em).length;
  return Math.max(0, divida.parcelas_restantes_inicial - quantidadePaga);
}

/** Soma o saldo devedor de todas as dívidas ativas — "Total em dívidas" da Visão Geral (Bloco
 * futuro, F) e da própria tela de Dívidas. */
export function saldoDevedorTotal(dividas: DividaPessoal[], pagamentos: PagamentoDividaPessoal[]): number {
  return dividas
    .filter((d) => d.situacao === "ativa")
    .reduce((soma, d) => soma + saldoDivida(d, pagamentos), 0);
}

/** Situação da parcela do MÊS CORRENTE: sem `dia_vencimento` cadastrado não dá pra avaliar
 * ("sem_vencimento"); já paga esse mês (existe pagamento não estornado com `data` no mês/ano de
 * `hojeISO`) é "em_dia"; sem pagamento esse mês e o dia já passou é "vencida"; senão "a_vencer". */
export function situacaoDividaVencimento(
  divida: DividaPessoal,
  pagamentosDaDivida: PagamentoDividaPessoal[],
  hojeISO: string
): "quitada" | "sem_vencimento" | "vencida" | "a_vencer" | "em_dia" {
  if (divida.situacao === "quitada") return "quitada";
  if (divida.dia_vencimento == null) return "sem_vencimento";
  const mesAtualKey = hojeISO.slice(0, 7); // "YYYY-MM"
  const diaHoje = Number(hojeISO.slice(8, 10));
  const pagouEsseMes = pagamentosDaDivida.some(
    (p) => p.divida_id === divida.id && !p.estornado_em && p.data.slice(0, 7) === mesAtualKey
  );
  if (pagouEsseMes) return "em_dia";
  return diaHoje > divida.dia_vencimento ? "vencida" : "a_vencer";
}

export type { SituacaoDividaPessoal };

// ── Bloco D: investimentos ────────────────────────────────────────────────────────────────────
// "Aporte não é despesa de consumo, resgate do principal não é receita nova" — por isso vivem
// numa tabela própria (`movimentos_investimento_pessoal`), nunca em despesas_pessoais/
// receitas_pessoais; saldo sempre derivado do ledger, mesmo padrão de `saldoConta`/`saldoDivida`.

export function saldoInvestimento(
  investimento: InvestimentoPessoal,
  movimentos: MovimentoInvestimentoPessoal[]
): number {
  return movimentos
    .filter((m) => m.investimento_id === investimento.id && !m.estornado_em)
    .reduce((s, m) => s + (m.tipo === "resgate" ? -m.valor : m.valor), 0);
}

/** Só o que foi efetivamente aportado (nunca soma resgate/rendimento) — "quanto entrou de
 * dinheiro novo", separado de "quanto vale hoje" (`saldoInvestimento`, que já inclui
 * rendimento acumulado). */
export function totalAportadoInvestimento(
  investimento: InvestimentoPessoal,
  movimentos: MovimentoInvestimentoPessoal[]
): number {
  return movimentos
    .filter((m) => m.investimento_id === investimento.id && m.tipo === "aporte" && !m.estornado_em)
    .reduce((s, m) => s + m.valor, 0);
}

/** Soma o saldo de todos os investimentos ativos — "Total em investimentos" da Visão Geral
 * (painel consolidado, Bloco F) e da própria tela de Investimentos. */
export function totalInvestidoGeral(
  investimentos: InvestimentoPessoal[],
  movimentos: MovimentoInvestimentoPessoal[]
): number {
  return investimentos.filter((i) => i.ativo).reduce((soma, i) => soma + saldoInvestimento(i, movimentos), 0);
}

export function rendimentoTotalInvestimento(
  investimento: InvestimentoPessoal,
  movimentos: MovimentoInvestimentoPessoal[]
): number {
  return movimentos
    .filter((m) => m.investimento_id === investimento.id && m.tipo === "rendimento" && !m.estornado_em)
    .reduce((s, m) => s + m.valor, 0);
}

// ── Bloco F: painel consolidado ─────────────────────────────────────────────────────────────
// Reaproveita só as funções que já existem de cada bloco — nunca recalcula nada novo aqui, só
// soma o que cada bloco já sabe calcular sozinho.

/** Soma, em todos os cartões ativos, o total de compras não canceladas cuja fatura ainda não
 * foi paga — é o mesmo conceito de `limiteUsado`, só agregado pra todos os cartões de uma vez
 * (aqui não interessa "limite", só "quanto ainda vou ter que pagar de fatura"). */
export function totalFaturasEmAberto(
  cartoes: CartaoPessoal[],
  compras: CompraCartaoPessoal[],
  despesasFatura: DespesaPessoal[]
): number {
  const faturasPagasPorCartao = new Map<string, Set<string>>();
  for (const d of despesasFatura) {
    if (d.situacao !== "paga" || !d.cartao_id || d.fatura_ano == null || d.fatura_mes == null) continue;
    const key = `${d.fatura_ano}-${String(d.fatura_mes).padStart(2, "0")}`;
    const set = faturasPagasPorCartao.get(d.cartao_id) ?? new Set<string>();
    set.add(key);
    faturasPagasPorCartao.set(d.cartao_id, set);
  }
  return cartoes
    .filter((c) => c.ativo)
    .reduce((soma, c) => soma + limiteUsado(c.id, compras, faturasPagasPorCartao.get(c.id) ?? new Set()), 0);
}

/** Patrimônio líquido = tudo que é seu (saldo nas contas + investido) menos tudo que você deve
 * (dívidas ativas + faturas de cartão ainda não pagas) — nunca inclui limite de cartão como se
 * fosse dinheiro (isso nunca é ativo). */
export function patrimonioLiquido(
  saldoContas: number,
  totalInvestido: number,
  saldoDevedorDividas: number,
  faturasEmAberto: number
): number {
  return saldoContas + totalInvestido - saldoDevedorDividas - faturasEmAberto;
}

import type { PeriodoFiltro, IndicadorFinanceiro, RegistroIndicador } from "./financas";
import type {
  ContaPessoal,
  ReceitaPessoal,
  DespesaPessoal,
  TransferenciaPessoal,
  SituacaoReceitaPessoal,
  SituacaoDespesaPessoal,
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
// de cartão ou investimento como saldo disponível (isso não é responsabilidade desta função —
// cartão/investimento entram em blocos futuros, com suas próprias funções).
export function saldoConta(
  conta: ContaPessoal,
  receitas: ReceitaPessoal[],
  despesas: DespesaPessoal[],
  transferencias: TransferenciaPessoal[]
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

  return saldo;
}

/** Soma o saldo de todas as contas ativas — "Saldo disponível nas contas" da Visão Geral. Nunca
 * inclui limite de cartão nem valor de investimento (regra explícita do pedido). */
export function saldoDisponivelTotal(
  contas: ContaPessoal[],
  receitas: ReceitaPessoal[],
  despesas: DespesaPessoal[],
  transferencias: TransferenciaPessoal[]
): number {
  return contas.filter((c) => c.ativa).reduce((soma, c) => soma + saldoConta(c, receitas, despesas, transferencias), 0);
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

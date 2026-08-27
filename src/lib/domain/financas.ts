import { yearMonthKeyTz, FUSO_OPERACAO } from "./dates";
import { contasAPagar } from "./dashboardMetrics";
import type {
  DespesaFixa,
  DespesaFixaOcorrencia,
  DespesaVariavel,
  DespesaVariavelOcorrencia,
  Lancamento,
  Servico,
  ServicoParcela,
} from "./types";

/**
 * Camada única de regras financeiras oficiais (Etapa 2) — todo indicador aqui é uma função
 * pura (recebe os dados já buscados, nunca chama o banco), pra ser testável sem mock e
 * reutilizável por Financeiro/Gestão/Hoje/Relatórios/Fechamento sem duplicar fórmula.
 */

export interface PeriodoFiltro {
  ano: number;
  mes: number; // 1-12
  inicio: string; // "YYYY-MM-DD"
  fim: string; // "YYYY-MM-DD"
  timezone: string;
}

export function periodoDoMes(ano: number, mes: number, timezone: string = FUSO_OPERACAO): PeriodoFiltro {
  const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const fim = `${ano}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
  return { ano, mes, inicio, fim, timezone };
}

function chaveDoPeriodo(periodo: PeriodoFiltro): string {
  return `${periodo.ano}-${String(periodo.mes).padStart(2, "0")}`;
}

export interface RegistroIndicador {
  id: string;
  descricao: string;
  valor: number;
  data: string;
}

/** Toda função de indicador devolve isso — a soma de `registros[].valor` sempre bate com
 * `total`, e fica explícito qual critério de data/status foi usado. */
export interface IndicadorFinanceiro {
  total: number;
  quantidade: number;
  registros: RegistroIndicador[];
  periodo: { inicio: string; fim: string };
  criterioData: string;
  statusConsiderados: string[];
  statusExcluidos: string[];
}

/** Remove lançamentos PREVISTOS vinculados a um serviço Cancelado — esse dinheiro nunca vai
 * entrar/sair porque o serviço não vai mais acontecer. Lançamentos REALIZADOS (dinheiro que já
 * se moveu de verdade antes do cancelamento) continuam contando — é fato histórico, cancelar
 * não apaga movimentação já feita (decisão confirmada). Chamar isso ANTES de passar
 * `lancamentos` pra qualquer indicador de "previsto"/"a receber"/"a pagar". */
export function excluirPrevistosDeServicoCancelado(
  lancamentos: Lancamento[],
  servicos: Pick<Servico, "id" | "financeiro_status">[]
): Lancamento[] {
  const canceladoIds = new Set(servicos.filter((s) => s.financeiro_status === "Cancelado").map((s) => s.id));
  return lancamentos.filter((l) => !(l.status === "previsto" && l.servico_id && canceladoIds.has(l.servico_id)));
}

// ── 1. Vendas aprovadas ──
export interface VendasAprovadas extends IndicadorFinanceiro {
  ticketMedio: number;
}

/** Venda só existe quando o orçamento vira uma OS aprovada — nunca conta orçamento em
 * elaboração/enviado nem OS cancelada. Mês determinado pela data de aprovação, não criação. */
export function vendasAprovadas(servicos: Servico[], periodo: PeriodoFiltro): VendasAprovadas {
  const chaveAlvo = chaveDoPeriodo(periodo);
  const registros: RegistroIndicador[] = [];
  for (const s of servicos) {
    if (s.numero == null || !s.aprovado_em) continue;
    if (s.financeiro_status === "Cancelado") continue;
    if (yearMonthKeyTz(s.aprovado_em, periodo.timezone) !== chaveAlvo) continue;
    registros.push({ id: s.id, descricao: `${s.numero} — ${s.cliente}`, valor: s.valor, data: s.aprovado_em });
  }
  const total = registros.reduce((sum, r) => sum + r.valor, 0);
  const quantidade = registros.length;
  return {
    total,
    quantidade,
    registros,
    ticketMedio: quantidade > 0 ? total / quantidade : 0,
    periodo: { inicio: periodo.inicio, fim: periodo.fim },
    criterioData: "Data de aprovação da OS (servicos.aprovado_em)",
    statusConsiderados: ["numero atribuído (é uma OS)", "financeiro_status ≠ Cancelado"],
    statusExcluidos: ["orçamento ainda não aprovado (numero nulo)", "financeiro_status = Cancelado"],
  };
}

// ── 2. Recebido / 4. Despesas pagas — mesma regra, tipo oposto ──
/** Só precisa de início/fim — funciona tanto com `periodoDoMes(...)` quanto com um intervalo
 * arbitrário escolhido pelo usuário (ex: filtro "De/Até" de Relatórios). */
export type IntervaloData = Pick<PeriodoFiltro, "inicio" | "fim">;

function somaLancamentosRealizados(
  lancamentos: Lancamento[],
  tipo: "Receita" | "Despesa",
  periodo: IntervaloData,
  criterioData: string
): IndicadorFinanceiro {
  const registros = lancamentos
    .filter((l) => l.tipo === tipo && l.status === "realizado" && l.data >= periodo.inicio && l.data <= periodo.fim)
    .map((l) => ({ id: l.id, descricao: l.descricao, valor: l.valor, data: l.data }));
  const total = registros.reduce((sum, r) => sum + r.valor, 0);
  return {
    total,
    quantidade: registros.length,
    registros,
    periodo: { inicio: periodo.inicio, fim: periodo.fim },
    criterioData,
    statusConsiderados: ["realizado"],
    statusExcluidos: ["previsto", "cancelado"],
  };
}

/** Dinheiro efetivamente recebido — nunca o valor total da OS quando só uma parte entrou. */
export function recebido(lancamentos: Lancamento[], periodo: IntervaloData): IndicadorFinanceiro {
  return somaLancamentosRealizados(lancamentos, "Receita", periodo, "Data real do recebimento (lancamentos.data, status=realizado)");
}

/** Dinheiro efetivamente pago — não conta como paga só por estar cadastrada/vencida/prevista. */
export function despesasPagas(lancamentos: Lancamento[], periodo: IntervaloData): IndicadorFinanceiro {
  return somaLancamentosRealizados(lancamentos, "Despesa", periodo, "Data real do pagamento (lancamentos.data, status=realizado)");
}

// ── 3. A receber ──
export interface IndicadorComVencidos extends IndicadorFinanceiro {
  vencidos: RegistroIndicador[];
}

/**
 * Saldo ainda não recebido: parcelas em aberto/parciais (só o saldo) + lançamentos previstos
 * de receita que não vieram de uma parcela (evita contar a mesma parcela duas vezes — ela já
 * tem um lançamento vinculado quando existe). Serviço Cancelado nunca entra aqui (não vai
 * receber mesmo) — chame `excluirPrevistosDeServicoCancelado` antes se `lancamentosPrevistos`
 * vier de uma fonte que ainda não filtrou isso.
 */
export function aReceber(
  servicos: Servico[],
  parcelas: ServicoParcela[],
  lancamentosPrevistos: Lancamento[],
  periodo: PeriodoFiltro,
  hojeISO: string
): IndicadorComVencidos {
  const servicoPorId = new Map(servicos.map((s) => [s.id, s]));
  const lancamentoIdsDeParcela = new Set(parcelas.map((p) => p.lancamento_id).filter((id): id is string => !!id));
  const registros: (RegistroIndicador & { vencido: boolean })[] = [];

  for (const p of parcelas) {
    const servico = servicoPorId.get(p.servico_id);
    if (servico?.financeiro_status === "Cancelado") continue;
    const pago = p.valor_pago ?? 0;
    const saldo = Math.max(0, p.valor_previsto - pago); // negativo vira 0 aqui — ver inconsistenciasFinanceiras
    if (saldo <= 0) continue;
    const vencimento = p.data_prevista;
    if (!vencimento || vencimento < periodo.inicio || vencimento > periodo.fim) continue;
    registros.push({
      id: p.id,
      descricao: `${servico?.numero ?? "—"} — ${p.descricao}`,
      valor: saldo,
      data: vencimento,
      vencido: vencimento < hojeISO,
    });
  }

  for (const l of lancamentosPrevistos) {
    if (l.tipo !== "Receita" || l.status !== "previsto") continue;
    if (lancamentoIdsDeParcela.has(l.id)) continue; // já contado via a parcela acima
    const servico = l.servico_id ? servicoPorId.get(l.servico_id) : undefined;
    if (servico?.financeiro_status === "Cancelado") continue;
    if (l.data < periodo.inicio || l.data > periodo.fim) continue;
    registros.push({ id: l.id, descricao: l.descricao, valor: l.valor, data: l.data, vencido: l.data < hojeISO });
  }

  const total = registros.reduce((sum, r) => sum + r.valor, 0);
  const toRegistro = (r: (typeof registros)[number]): RegistroIndicador => ({ id: r.id, descricao: r.descricao, valor: r.valor, data: r.data });
  return {
    total,
    quantidade: registros.length,
    registros: registros.map(toRegistro),
    periodo: { inicio: periodo.inicio, fim: periodo.fim },
    criterioData: "Data de vencimento (parcela.data_prevista ou lançamento.data)",
    statusConsiderados: ["parcela em aberto/parcial", "lançamento previsto de receita"],
    statusExcluidos: ["já recebido", "serviço cancelado", "parcela já coberta por outro lançamento"],
    vencidos: registros.filter((r) => r.vencido).map(toRegistro),
  };
}

/** Saldo total em aberto de UM serviço (ou cliente, somando as OS dele) — sem escopo de mês,
 * pra não confundir com o total do cartão mensal. */
export function saldoAbertoDoServico(servico: Servico, parcelasDoServico: ServicoParcela[]): number {
  if (servico.financeiro_status === "Cancelado") return 0;
  if (parcelasDoServico.length === 0) return Math.max(0, servico.valor - servico.valor_pago);
  return parcelasDoServico.reduce((sum, p) => sum + Math.max(0, p.valor_previsto - (p.valor_pago ?? 0)), 0);
}

// ── 5. A pagar (reaproveita contasAPagar, já testado e em uso) ──
/** Despesas válidas ainda não quitadas com vencimento no período — reaproveita `contasAPagar`
 * (já trata fixa/variável/avulsa sem contar a despesa recorrente e sua ocorrência ao mesmo
 * tempo) e só empacota no envelope + separa vencidos. `lancamentosPrevistosDespesa` deve vir
 * já sem os vinculados a serviço Cancelado (`excluirPrevistosDeServicoCancelado`). */
export function aPagar(
  despesasFixas: DespesaFixa[],
  ocorrenciasFixasDoMes: DespesaFixaOcorrencia[],
  despesasVariaveis: DespesaVariavel[],
  ocorrenciasVariaveisDoMes: DespesaVariavelOcorrencia[],
  lancamentosPrevistosDespesa: Lancamento[],
  periodo: PeriodoFiltro,
  hojeISO: string
): IndicadorComVencidos {
  const itens = contasAPagar(
    despesasFixas,
    ocorrenciasFixasDoMes,
    despesasVariaveis,
    ocorrenciasVariaveisDoMes,
    lancamentosPrevistosDespesa,
    hojeISO
  ).filter((i) => i.vencimento >= periodo.inicio && i.vencimento <= periodo.fim);

  const registros = itens.map((i) => ({ id: i.id, descricao: i.descricao, valor: i.valor, data: i.vencimento }));
  const total = registros.reduce((sum, r) => sum + r.valor, 0);
  return {
    total,
    quantidade: registros.length,
    registros,
    periodo: { inicio: periodo.inicio, fim: periodo.fim },
    criterioData: "Data de vencimento (dia_vencimento da fixa, data da variável, ou data do lançamento previsto)",
    statusConsiderados: ["despesa fixa/variável ativa não paga", "lançamento previsto de despesa"],
    statusExcluidos: ["despesa inativa", "já paga", "serviço cancelado"],
    vencidos: itens.filter((i) => i.atrasado).map((i) => ({ id: i.id, descricao: i.descricao, valor: i.valor, data: i.vencimento })),
  };
}

// ── 7/8/9. Resultados — composição pura sobre os totais acima ──
export function resultadoRealizado(recebidoTotal: number, despesasPagasTotal: number): number {
  return recebidoTotal - despesasPagasTotal;
}

export function resultadoPendente(aReceberTotal: number, aPagarTotal: number): number {
  return aReceberTotal - aPagarTotal;
}

/** Sem duplicar valores já contados: soma o que já é fato (recebido/pago) com o que ainda é
 * expectativa (a receber/a pagar), cada um vindo de uma fonte exclusiva (lancamentos
 * realizado vs. parcela/lancamento previsto). */
export function resultadoPrevistoFinal(
  recebidoTotal: number,
  aReceberTotal: number,
  despesasPagasTotal: number,
  aPagarTotal: number
): number {
  return recebidoTotal + aReceberTotal - despesasPagasTotal - aPagarTotal;
}

// ── Duplicidades — generaliza a heurística já usada em conciliarExtrato ──
export interface DuplicidadeLancamento {
  original: Lancamento;
  possivelDuplicata: Lancamento;
  motivo: string;
}

function normalizarDescricao(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function diasEntreDatas(a: string, b: string): number {
  const da = new Date(a + "T00:00:00").getTime();
  const db = new Date(b + "T00:00:00").getTime();
  return Math.abs(Math.round((da - db) / 86_400_000));
}

/** Mesmo critério já usado em `conciliarExtrato` (src/lib/domain/extrato.ts): mesmo tipo,
 * valor±1 centavo, descrição igual normalizada, data a até 3 dias — só relata, nunca decide
 * sozinho qual registro apagar. */
export function duplicidadesLancamentos(lancamentos: Lancamento[]): DuplicidadeLancamento[] {
  const achados: DuplicidadeLancamento[] = [];
  for (let i = 0; i < lancamentos.length; i++) {
    for (let j = i + 1; j < lancamentos.length; j++) {
      const a = lancamentos[i];
      const b = lancamentos[j];
      if (
        a.tipo === b.tipo &&
        Math.abs(a.valor - b.valor) < 0.01 &&
        normalizarDescricao(a.descricao) === normalizarDescricao(b.descricao) &&
        diasEntreDatas(a.data, b.data) <= 3
      ) {
        achados.push({ original: a, possivelDuplicata: b, motivo: "Mesma descrição, valor e data próxima (≤3 dias)" });
      }
    }
  }
  return achados;
}

// ── Inconsistências — pra revisão manual, nunca corrigidas sozinhas ──
export interface InconsistenciaFinanceira {
  tipo: "saldo_negativo" | "aprovado_sem_data";
  descricao: string;
  registroId: string;
}

export function inconsistenciasFinanceiras(servicos: Servico[], parcelas: ServicoParcela[]): InconsistenciaFinanceira[] {
  const achados: InconsistenciaFinanceira[] = [];
  for (const p of parcelas) {
    const pago = p.valor_pago ?? 0;
    if (pago > p.valor_previsto) {
      achados.push({
        tipo: "saldo_negativo",
        descricao: `Parcela "${p.descricao}" recebeu ${pago} mas previa ${p.valor_previsto} — saldo ficaria negativo`,
        registroId: p.id,
      });
    }
  }
  for (const s of servicos) {
    if (s.numero != null && !s.aprovado_em) {
      achados.push({
        tipo: "aprovado_sem_data",
        descricao: `${s.numero} tem numeração de OS mas não tem data de aprovação registrada`,
        registroId: s.id,
      });
    }
  }
  return achados;
}

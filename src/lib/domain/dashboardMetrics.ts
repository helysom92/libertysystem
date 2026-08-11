import { TIPO_LABELS, type ServicoTipo } from "./flows";
import { computeClienteStats } from "./clientes";
import type {
  Cliente,
  DespesaFixa,
  DespesaFixaOcorrencia,
  Evento,
  ItemOrcamento,
  Lancamento,
  OrcamentoItemRow,
  Servico,
} from "./types";

export type MetaTipo = "vendas_mensais" | "despesas_mensais" | "novos_clientes" | "margem_liquida";

export interface Meta {
  id: string;
  tipo: MetaTipo;
  valor_alvo: number;
  atualizado_em: string;
}

// Categorical palette (identity, not status) — validated with the dataviz skill's
// validator against this app's dark card surface (#1d1f23): all 6 checks pass in
// fixed order. Deliberately distinct from the app's status colors (success/warning/
// danger), which stay reserved for state, never reused as generic series identity.
const PALETTE = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181"];
const PALETTE_OUTROS = "var(--color-text-muted)";
const MAX_FATIAS = PALETTE.length;

export function fmtPct(n: number, digits = 1): string {
  return `${n.toFixed(digits).replace(".", ",")}%`;
}

function mesLabel(year: number, month: number): string {
  const raw = new Date(year, month, 1).toLocaleDateString("pt-BR", { month: "short" });
  const cleaned = raw.replace(".", "");
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function yearMonthKey(dateIso: string): string {
  return dateIso.slice(0, 7); // "YYYY-MM"
}

/**
 * "YYYY-MM" a partir dos componentes LOCAIS de um Date — não usar `.toISOString()` aqui
 * (converte pra UTC antes de formatar; no fuso do Brasil isso vira o mês seguinte nas
 * últimas horas de todo dia 1º-3, fazendo o "mês atual" divergir do resto do dashboard).
 */
function yearMonthKeyLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ── Série mensal (base pra Visão Geral, Vendas, Despesas, Comparativo, Histórico) ──
export interface MonthPoint {
  key: string; // "YYYY-MM"
  label: string; // "Ago/26"
  year: number;
  month: number; // 0-11
  sales: number;
  expenses: number;
}

export function monthlySeries(lancamentos: Lancamento[], refDate: Date, months: number): MonthPoint[] {
  const points: MonthPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(refDate.getFullYear(), refDate.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const key = `${year}-${String(month + 1).padStart(2, "0")}`;
    points.push({ key, label: `${mesLabel(year, month)}/${String(year).slice(2)}`, year, month, sales: 0, expenses: 0 });
  }
  const byKey = new Map(points.map((p) => [p.key, p]));
  for (const l of lancamentos) {
    if (l.status !== "realizado") continue;
    const p = byKey.get(yearMonthKey(l.data));
    if (!p) continue;
    if (l.tipo === "Receita") p.sales += l.valor;
    else p.expenses += l.valor;
  }
  return points;
}

// ── Visão Geral: KPIs do mês atual + delta + anel de progresso ──
export interface KpiCardData {
  label: string;
  value: number;
  isPct?: boolean;
  deltaPct: number | null;
  ringPct: number;
}

export interface KpisVisaoGeral {
  receita: KpiCardData;
  despesas: KpiCardData;
  lucro: KpiCardData;
  margem: KpiCardData;
}

function pctDelta(atual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return ((atual - anterior) / anterior) * 100;
}

export function kpisVisaoGeral(
  monthly: MonthPoint[],
  metas: Meta[],
  index: number = monthly.length - 1
): KpisVisaoGeral {
  const metaByTipo = new Map(metas.map((m) => [m.tipo, m.valor_alvo]));
  const atual = monthly[index];
  const anterior = index > 0 ? monthly[index - 1] : null;

  const lucroAtual = atual.sales - atual.expenses;
  const lucroAnterior = anterior ? anterior.sales - anterior.expenses : 0;
  const margemAtual = atual.sales > 0 ? (lucroAtual / atual.sales) * 100 : 0;
  const margemAnterior = anterior && anterior.sales > 0 ? (lucroAnterior / anterior.sales) * 100 : 0;

  const maxSalesHist = Math.max(1, ...monthly.map((m) => m.sales));
  const maxExpHist = Math.max(1, ...monthly.map((m) => m.expenses));

  const metaVendas = metaByTipo.get("vendas_mensais") ?? 0;
  const metaDespesas = metaByTipo.get("despesas_mensais") ?? 0;
  const metaMargem = metaByTipo.get("margem_liquida") ?? 0;

  return {
    receita: {
      label: "Receita do mês",
      value: atual.sales,
      deltaPct: anterior ? pctDelta(atual.sales, anterior.sales) : null,
      ringPct: Math.min(100, (atual.sales / (metaVendas || maxSalesHist)) * 100),
    },
    despesas: {
      label: "Despesas do mês",
      value: atual.expenses,
      deltaPct: anterior ? pctDelta(atual.expenses, anterior.expenses) : null,
      ringPct: Math.min(100, (atual.expenses / (metaDespesas || maxExpHist)) * 100),
    },
    lucro: {
      label: "Lucro líquido",
      value: lucroAtual,
      deltaPct: anterior ? pctDelta(lucroAtual, lucroAnterior) : null,
      ringPct: Math.min(
        100,
        Math.max(0, (lucroAtual / ((metaVendas && metaDespesas ? metaVendas - metaDespesas : null) || Math.max(1, maxSalesHist - maxExpHist))) * 100)
      ),
    },
    margem: {
      label: "Margem líquida",
      value: margemAtual,
      isPct: true,
      deltaPct: anterior ? margemAtual - margemAnterior : null,
      ringPct: Math.min(100, Math.max(0, (margemAtual / (metaMargem || 40)) * 100)),
    },
  };
}

// ── "Até hoje" — só faz sentido pro mês em andamento: quanto já vendi/gastei até este dia,
// contra o mesmo dia do mês anterior (não o mês inteiro, que ainda nem terminou). ──
export interface MtdComparativo {
  diaCorte: number;
  vendasAtual: number;
  vendasAnterior: number;
  deltaVendasPct: number | null;
  despesasAtual: number;
  despesasAnterior: number;
  deltaDespesasPct: number | null;
}

export function mtdComparativo(
  lancamentos: Lancamento[],
  year: number,
  month: number, // 0-11
  diaCorte: number
): MtdComparativo {
  function somaAteDia(y: number, m: number, dia: number, tipo: "Receita" | "Despesa"): number {
    return lancamentos
      .filter((l) => l.status === "realizado" && l.tipo === tipo)
      .filter((l) => {
        const d = new Date(l.data + "T00:00:00");
        return d.getFullYear() === y && d.getMonth() === m && d.getDate() <= dia;
      })
      .reduce((acc, l) => acc + l.valor, 0);
  }

  const prevDate = new Date(year, month - 1, 1);
  const prevYear = prevDate.getFullYear();
  const prevMonth = prevDate.getMonth();
  // Fevereiro não tem dia 31 — se o corte for maior que os dias do mês anterior, usa o
  // último dia dele (equivalente a "o mês inteiro" nesse caso).
  const diasNoMesAnterior = new Date(prevYear, prevMonth + 1, 0).getDate();
  const diaCorteAnterior = Math.min(diaCorte, diasNoMesAnterior);

  const vendasAtual = somaAteDia(year, month, diaCorte, "Receita");
  const vendasAnterior = somaAteDia(prevYear, prevMonth, diaCorteAnterior, "Receita");
  const despesasAtual = somaAteDia(year, month, diaCorte, "Despesa");
  const despesasAnterior = somaAteDia(prevYear, prevMonth, diaCorteAnterior, "Despesa");

  return {
    diaCorte,
    vendasAtual,
    vendasAnterior,
    deltaVendasPct: pctDelta(vendasAtual, vendasAnterior),
    despesasAtual,
    despesasAnterior,
    deltaDespesasPct: pctDelta(despesasAtual, despesasAnterior),
  };
}

// ── Fatias de categoria (donut) ──
export interface CategoriaFatia {
  label: string;
  valor: number;
  pct: number;
  color: string;
}

function toFatias(porLabel: Map<string, number>): CategoriaFatia[] {
  const total = [...porLabel.values()].reduce((a, b) => a + b, 0);
  const sorted = [...porLabel.entries()].sort((a, b) => b[1] - a[1]);
  const principais = sorted.slice(0, MAX_FATIAS);
  const resto = sorted.slice(MAX_FATIAS);

  const fatias: CategoriaFatia[] = principais.map(([label, valor], i) => ({
    label,
    valor,
    pct: total > 0 ? (valor / total) * 100 : 0,
    color: PALETTE[i],
  }));

  if (resto.length > 0) {
    const valorResto = resto.reduce((sum, [, v]) => sum + v, 0);
    fatias.push({
      label: "Outros",
      valor: valorResto,
      pct: total > 0 ? (valorResto / total) * 100 : 0,
      color: PALETTE_OUTROS,
    });
  }

  return fatias;
}

export function vendasPorTipo(servicos: Servico[], refDate: Date): CategoriaFatia[] {
  const key = yearMonthKeyLocal(refDate);
  const porTipo = new Map<string, number>();
  for (const s of servicos) {
    if (yearMonthKeyLocal(new Date(s.criado_em)) !== key) continue;
    const label = TIPO_LABELS[s.tipo as ServicoTipo] ?? s.tipo;
    porTipo.set(label, (porTipo.get(label) ?? 0) + s.valor);
  }
  return toFatias(porTipo);
}

export function despesasPorCategoria(lancamentos: Lancamento[], refDate: Date): CategoriaFatia[] {
  const key = yearMonthKeyLocal(refDate);
  const porCategoria = new Map<string, number>();
  for (const l of lancamentos) {
    if (l.tipo !== "Despesa" || l.status !== "realizado" || yearMonthKey(l.data) !== key) continue;
    const label = l.categoria || "Sem categoria";
    porCategoria.set(label, (porCategoria.get(label) ?? 0) + l.valor);
  }
  return toFatias(porCategoria);
}

// ── Top clientes / top itens do catálogo ──
export interface TopClienteItem {
  nome: string;
  valor: number;
}

export function topClientesGeral(servicos: Servico[], clientes: Cliente[], limit = 5): TopClienteItem[] {
  return clientes
    .map((c) => ({ nome: c.nome, valor: computeClienteStats(c.id, servicos).totalComprado }))
    .filter((c) => c.valor > 0)
    .sort((a, b) => b.valor - a.valor)
    .slice(0, limit);
}

export interface TopItemCatalogo {
  nome: string;
  quantidade: number;
  receita: number;
}

/** Ranking geral (não só do mês) — igual a `topClientesGeral`, mais estável pra um negócio pequeno. */
export function topItensCatalogo(
  orcamentoItens: OrcamentoItemRow[],
  itensOrcamento: ItemOrcamento[],
  limit = 5
): TopItemCatalogo[] {
  const porItem = new Map<string, { quantidade: number; receita: number }>();
  for (const row of orcamentoItens) {
    if (!row.item_orcamento_id) continue;
    const catalogo = itensOrcamento.find((i) => i.id === row.item_orcamento_id);
    if (!catalogo) continue;
    const entry = porItem.get(catalogo.nome) ?? { quantidade: 0, receita: 0 };
    entry.quantidade += row.quantidade;
    entry.receita += row.valor_final;
    porItem.set(catalogo.nome, entry);
  }
  return [...porItem.entries()]
    .map(([nome, v]) => ({ nome, ...v }))
    .sort((a, b) => b.receita - a.receita)
    .slice(0, limit);
}

// ── Comparativo e Histórico ──
export interface CompareRow {
  label: string;
  aValor: number;
  bValor: number;
}

export function compararMeses(monthly: MonthPoint[], indexA: number, indexB: number): CompareRow[] {
  const a = monthly[indexA];
  const b = monthly[indexB];
  return [
    { label: "Vendas", aValor: a.sales, bValor: b.sales },
    { label: "Despesas", aValor: a.expenses, bValor: b.expenses },
    { label: "Lucro", aValor: a.sales - a.expenses, bValor: b.sales - b.expenses },
  ];
}

export interface HistoricoRow {
  label: string;
  sales: number;
  expenses: number;
  profit: number;
  margin: number;
  barPct: number;
}

export function historico12Meses(monthly: MonthPoint[]): HistoricoRow[] {
  const profits = monthly.map((m) => m.sales - m.expenses);
  const maxProfit = Math.max(1, ...profits);
  return monthly.map((m, i) => ({
    label: m.label,
    sales: m.sales,
    expenses: m.expenses,
    profit: profits[i],
    margin: m.sales > 0 ? (profits[i] / m.sales) * 100 : 0,
    barPct: Math.max(0, (profits[i] / maxProfit) * 100),
  }));
}

// ── Calendário ──
export interface CalendarEvent {
  tipo: "vencimento" | "compromisso";
  titulo: string;
  valor: number | null;
}

export function eventosDoCalendario(
  eventos: Evento[],
  despesasFixas: DespesaFixa[],
  despesasFixasOcorrencias: DespesaFixaOcorrencia[],
  lancamentos: Lancamento[],
  year: number,
  month: number // 0-11
): Record<string, CalendarEvent[]> {
  const map: Record<string, CalendarEvent[]> = {};
  const push = (dateStr: string, ev: CalendarEvent) => {
    (map[dateStr] ??= []).push(ev);
  };

  for (const ev of eventos) {
    push(ev.data, { tipo: "compromisso", titulo: `${ev.tipo}${ev.cliente ? " — " + ev.cliente : ""}`, valor: null });
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (const df of despesasFixas) {
    if (!df.ativo) continue;
    const dia = Math.min(df.dia_vencimento, daysInMonth);
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    const ocorrencia = despesasFixasOcorrencias.find(
      (o) => o.despesa_fixa_id === df.id && o.ano === year && o.mes === month + 1
    );
    if (ocorrencia?.pago) continue;
    push(dateStr, { tipo: "vencimento", titulo: df.descricao, valor: df.valor });
  }

  for (const l of lancamentos) {
    if (l.status !== "previsto") continue;
    if (yearMonthKey(l.data) !== `${year}-${String(month + 1).padStart(2, "0")}`) continue;
    push(l.data, { tipo: "vencimento", titulo: l.descricao, valor: l.valor });
  }

  return map;
}

export interface ProximoItem {
  dateStr: string;
  dia: string;
  mes: string;
  titulo: string;
  tipo: "vencimento" | "compromisso";
  valor: number | null;
}

/** Próximos vencimentos/compromissos a partir de hoje, olhando os próximos `days` dias. */
export function proximosEventos(
  eventos: Evento[],
  despesasFixas: DespesaFixa[],
  despesasFixasOcorrencias: DespesaFixaOcorrencia[],
  lancamentos: Lancamento[],
  hojeISO: string,
  days = 21,
  limit = 5
): ProximoItem[] {
  const [hy, hm] = hojeISO.split("-").map(Number);
  const meses = new Set<string>();
  for (let i = 0; i <= Math.ceil(days / 28) + 1; i++) {
    const d = new Date(hy, hm - 1 + i, 1);
    meses.add(`${d.getFullYear()}-${d.getMonth()}`);
  }

  const fim = new Date(hojeISO + "T00:00:00");
  fim.setDate(fim.getDate() + days);

  const items: ProximoItem[] = [];
  for (const mesKey of meses) {
    const [y, m] = mesKey.split("-").map(Number);
    const mapa = eventosDoCalendario(eventos, despesasFixas, despesasFixasOcorrencias, lancamentos, y, m);
    for (const [dateStr, evs] of Object.entries(mapa)) {
      if (dateStr < hojeISO || dateStr > toISODateLocal(fim)) continue;
      for (const ev of evs) {
        const d = new Date(dateStr + "T00:00:00");
        items.push({
          dateStr,
          dia: String(d.getDate()).padStart(2, "0"),
          mes: mesLabel(d.getFullYear(), d.getMonth()).toUpperCase(),
          titulo: ev.titulo,
          tipo: ev.tipo,
          valor: ev.valor,
        });
      }
    }
  }

  return items.sort((a, b) => a.dateStr.localeCompare(b.dateStr)).slice(0, limit);
}

function toISODateLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface CalendarCell {
  day: number;
  dateStr: string | null;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  hasVencimento: boolean;
  hasCompromisso: boolean;
}

export function buildMonthGrid(
  year: number,
  month: number, // 0-11
  hojeISO: string,
  selectedDate: string,
  eventosPorDia: Record<string, CalendarEvent[]>
): CalendarCell[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const raw: { day: number; inMonth: boolean; dateStr: string | null }[] = [];

  for (let i = 0; i < firstDay; i++) {
    raw.push({ day: daysInPrev - firstDay + 1 + i, inMonth: false, dateStr: null });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    raw.push({ day: d, inMonth: true, dateStr: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
  }
  let extra = 1;
  while (raw.length < 42) {
    raw.push({ day: extra++, inMonth: false, dateStr: null });
  }

  return raw.map((c) => {
    const evs = c.dateStr ? (eventosPorDia[c.dateStr] ?? []) : [];
    return {
      day: c.day,
      dateStr: c.dateStr,
      inMonth: c.inMonth,
      isToday: c.dateStr === hojeISO,
      isSelected: c.dateStr === selectedDate,
      hasVencimento: evs.some((e) => e.tipo === "vencimento"),
      hasCompromisso: evs.some((e) => e.tipo === "compromisso"),
    };
  });
}

// ── Metas ──
export interface MetaClassificacao {
  pct: number;
  status: string;
  statusColor: string;
}

export const META_LABELS: Record<MetaTipo, string> = {
  vendas_mensais: "Vendas mensais",
  despesas_mensais: "Controle de despesas",
  novos_clientes: "Novos clientes / mês",
  margem_liquida: "Margem de lucro",
};

const METAS_TETO: MetaTipo[] = ["despesas_mensais"];

// Hex literal (não var(--...)) — Pill.tsx monta o fundo/borda com sufixo de alfa
// (`${color}22`), que só funciona com hex de 6 dígitos, igual ao FinanceiroBadge.
const COR_SUCCESS = "#25D366";
const COR_WARNING = "#E0A64E";
const COR_DANGER = "#E07A7A";
const COR_NEUTRA = "#B5AFA0";

export function classificarMeta(tipo: MetaTipo, alvo: number, atual: number): MetaClassificacao {
  if (alvo <= 0) {
    return { pct: 0, status: "Sem meta definida", statusColor: COR_NEUTRA };
  }
  const isTeto = METAS_TETO.includes(tipo);
  const pct = (atual / alvo) * 100;

  if (isTeto) {
    if (pct <= 90) return { pct: Math.min(100, pct), status: "Dentro da meta", statusColor: COR_SUCCESS };
    if (pct <= 100) return { pct: Math.min(100, pct), status: "Quase no limite", statusColor: COR_WARNING };
    return { pct: Math.min(100, pct), status: "Acima da meta", statusColor: COR_DANGER };
  }

  if (pct >= 100) return { pct: Math.min(120, pct), status: "Meta superada", statusColor: COR_SUCCESS };
  if (pct >= 90) return { pct, status: "Quase lá", statusColor: COR_WARNING };
  return { pct, status: "Abaixo da meta", statusColor: COR_DANGER };
}

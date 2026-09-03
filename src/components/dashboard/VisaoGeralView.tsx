import { fmtBRL } from "@/lib/domain/types";
import {
  fmtPct,
  type KpisVisaoGeral,
  type MonthPoint,
  type MtdComparativo,
  type ProximoItem,
  type TopClienteItem,
} from "@/lib/domain/dashboardMetrics";
import ProgressRing from "./charts/ProgressRing";
import BarChart from "./charts/BarChart";
import LineAreaChart from "./charts/LineAreaChart";
import MonthNavBar from "./MonthNavBar";
import VisaoGeralFinanceiroClient, { type DadosVisaoGeral } from "@/components/financeiro/VisaoGeralFinanceiroClient";

function KpiCard({
  label,
  value,
  isPct,
  deltaPct,
  ringPct,
  invert,
}: {
  label: string;
  value: number;
  isPct?: boolean;
  deltaPct: number | null;
  ringPct: number;
  invert?: boolean;
}) {
  const positivo = deltaPct != null && (invert ? deltaPct <= 0 : deltaPct >= 0);
  const deltaColor = deltaPct == null ? "var(--color-text-muted)" : positivo ? "var(--color-success)" : "var(--color-danger)";
  const deltaText =
    deltaPct == null ? "sem comparativo" : `${deltaPct >= 0 ? "↑" : "↓"} ${fmtPct(Math.abs(deltaPct))} vs mês anterior`;

  return (
    <div className="flex items-center gap-4 rounded-card border border-border-neutral bg-card p-4 text-left">
      <ProgressRing pct={ringPct} label={`${Math.round(ringPct)}%`} />
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-text-secondary">{label}</p>
        <p className="mt-0.5 font-display text-[19px] font-bold text-text">{isPct ? fmtPct(value) : fmtBRL(value)}</p>
        <p className="mt-0.5 text-[12px] font-semibold" style={{ color: deltaColor }}>
          {deltaText}
        </p>
      </div>
    </div>
  );
}

function MtdRow({
  label,
  atual,
  anterior,
  deltaPct,
  invertColor,
}: {
  label: string;
  atual: number;
  anterior: number;
  deltaPct: number | null;
  invertColor?: boolean;
}) {
  const positivo = deltaPct != null && (invertColor ? deltaPct <= 0 : deltaPct >= 0);
  const deltaColor = deltaPct == null ? "var(--color-text-muted)" : positivo ? "var(--color-success)" : "var(--color-danger)";
  return (
    <div className="rounded-btn bg-card-secondary p-3.5">
      <p className="text-[12px] font-semibold text-text-secondary">{label}</p>
      <p className="mt-0.5 font-display text-[18px] font-bold text-text">{fmtBRL(atual)}</p>
      <p className="mt-1 text-[12px] text-text-muted">mesmo período mês passado: {fmtBRL(anterior)}</p>
      <p className="mt-0.5 text-[12px] font-semibold" style={{ color: deltaColor }}>
        {deltaPct == null ? "sem comparativo" : `${deltaPct >= 0 ? "↑" : "↓"} ${fmtPct(Math.abs(deltaPct))}`}
      </p>
    </div>
  );
}

export default function VisaoGeralView({
  kpis,
  faturamentoMes,
  dadosIndicadores,
  ano,
  mes,
  monthly6,
  monthly12,
  upcoming,
  topClientes,
  monthLabel,
  isMesAtual,
  onPrevMonth,
  onNextMonth,
  disableNext,
  mtd,
}: {
  kpis: KpisVisaoGeral;
  faturamentoMes: number;
  dadosIndicadores: DadosVisaoGeral;
  ano: number;
  mes: number;
  monthly6: MonthPoint[];
  monthly12: MonthPoint[];
  upcoming: ProximoItem[];
  topClientes: TopClienteItem[];
  monthLabel: string;
  isMesAtual: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  disableNext: boolean;
  mtd: MtdComparativo | null;
}) {
  return (
    <div>
      <MonthNavBar label={monthLabel} onPrev={onPrevMonth} onNext={onNextMonth} disableNext={disableNext} isCurrent={isMesAtual} />

      <div className="mb-4 rounded-card border border-border-neutral bg-card-secondary p-4">
        <p className="text-[12px] font-semibold text-text-secondary">Faturamento do Mês</p>
        <p className="mt-0.5 font-display text-[22px] font-bold text-gradient-gold">{fmtBRL(faturamentoMes)}</p>
        <p className="mt-0.5 text-[11.5px] text-text-muted">Valor das OS aprovadas nesse mês, pago ou não</p>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard {...kpis.receita} />
        <KpiCard {...kpis.despesas} invert />
        <KpiCard {...kpis.margem} />
      </div>

      <div className="mb-5">
        <p className="mb-2 text-[10.5px] tracking-wide text-text-muted uppercase">
          Indicadores oficiais do mês — clique num cartão pra ver os registros
        </p>
        <VisaoGeralFinanceiroClient erro={null} dados={dadosIndicadores} podeVerResultado ano={ano} mes={mes} />
      </div>

      {mtd && (
        <div className="mb-5 rounded-card border border-border-neutral bg-card p-5">
          <p className="mb-3 font-display text-[15px] font-bold text-text">
            Até dia {mtd.diaCorte} — contra o mesmo período do mês passado
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <MtdRow label="Vendido" atual={mtd.vendasAtual} anterior={mtd.vendasAnterior} deltaPct={mtd.deltaVendasPct} />
            <MtdRow
              label="Gasto"
              atual={mtd.despesasAtual}
              anterior={mtd.despesasAnterior}
              deltaPct={mtd.deltaDespesasPct}
              invertColor
            />
          </div>
        </div>
      )}

      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-card border border-border-neutral bg-card-secondary p-5">
          <p className="mb-4 font-display text-[15px] font-bold text-text">Vendas x Despesas — últimos 6 meses</p>
          <BarChart
            series={[
              { key: "sales", label: "Vendas", color: "var(--color-gold)" },
              { key: "expenses", label: "Despesas", color: "var(--color-text-muted)" },
            ]}
            data={monthly6.map((m) => ({ label: m.label, values: [m.sales, m.expenses] }))}
            fmt={fmtBRL}
          />
        </div>
        <div className="rounded-card border border-border-neutral bg-card p-5">
          <p className="mb-4 font-display text-[15px] font-bold text-text">Evolução do resultado — 12 meses</p>
          <LineAreaChart
            points={monthly12.map((m) => m.sales - m.expenses)}
            labels={monthly12.map((m) => m.label)}
            fmt={fmtBRL}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="rounded-card border border-border-neutral bg-card p-5">
          <p className="mb-3 font-display text-[15px] font-bold text-text">Próximos vencimentos e compromissos</p>
          {upcoming.length === 0 && <p className="text-[12.5px] text-text-muted">Nada nos próximos dias.</p>}
          <div className="flex flex-col">
            {upcoming.map((u, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-border-neutral py-2.5 last:border-0">
                <div className="w-10 flex-none text-center">
                  <p className="text-[15px] font-bold text-text">{u.dia}</p>
                  <p className="text-[10px] text-text-muted">{u.mes}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-text">{u.titulo}</p>
                  <p
                    className="text-[11px] font-semibold"
                    style={{ color: u.tipo === "vencimento" ? "var(--color-text-secondary)" : "var(--color-gold)" }}
                  >
                    {u.tipo === "vencimento" ? "Vencimento" : "Compromisso"}
                  </p>
                </div>
                <p className="text-[13px] font-semibold text-text">{u.valor != null ? fmtBRL(u.valor) : "—"}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-card border border-border-neutral bg-card p-5">
          <p className="mb-3 font-display text-[15px] font-bold text-text">Top clientes</p>
          {topClientes.length === 0 && <p className="text-[12.5px] text-text-muted">Sem dados ainda.</p>}
          <div className="flex flex-col">
            {topClientes.map((c) => (
              <div key={c.nome} className="flex items-center justify-between border-b border-border-neutral py-2 last:border-0">
                <p className="text-[13px] font-semibold text-text">{c.nome}</p>
                <p className="text-[13px] font-semibold text-gold">{fmtBRL(c.valor)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

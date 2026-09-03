"use client";

import { useMemo, useState } from "react";
import type { IndicadorFinanceiro, RegistroIndicador } from "@/lib/domain/financas";
import { fmtBRL } from "@/lib/domain/types";
import type { DespesaPessoal, ReceitaPessoal } from "@/lib/domain/types";
import { fmtDatePtBR } from "@/lib/domain/dates";
import type { MesPessoal } from "@/lib/domain/financasPessoais";
import { eventosDoCalendarioPessoal } from "@/lib/domain/financasPessoais";
import { buildMonthGrid } from "@/lib/domain/dashboardMetrics";
import IndicadorCard from "@/components/financeiro/IndicadorCard";
import DetalhamentoIndicadorModal from "@/components/financeiro/DetalhamentoIndicadorModal";
import BarChart from "@/components/dashboard/charts/BarChart";
import CalendarioView from "@/components/dashboard/CalendarioView";

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

interface DadosVisaoGeralPessoal {
  recebido: IndicadorFinanceiro;
  pago: IndicadorFinanceiro;
  aReceber: IndicadorFinanceiro & { vencidos: IndicadorFinanceiro["registros"] };
  aPagar: IndicadorFinanceiro & { vencidos: IndicadorFinanceiro["registros"] };
  resultadoRealizado: number;
  comparacaoMesAnterior: { recebido: number; pago: number; resultadoRealizado: number };
  compromissosProximos: RegistroIndicador[];
  receitasProximas: RegistroIndicador[];
  saldoDisponivel: number;
  contasComSaldoConhecido: boolean;
  totalInvestido: number;
  totalDividas: number;
  faturasEmAberto: number;
  patrimonioLiquido: number;
  serieMensal12: MesPessoal[];
  despesas: DespesaPessoal[];
  receitas: ReceitaPessoal[];
}

/** `inverter=true` pra métricas onde subir é ruim (ex: despesas) — verde/vermelho invertidos. */
function deltaTexto(atual: number, anterior: number, inverter = false): { texto: string; cor: string } {
  if (anterior === 0) {
    if (atual === 0) return { texto: "sem mudança vs mês anterior", cor: "var(--color-text-muted)" };
    return { texto: "mês anterior sem movimento", cor: "var(--color-text-muted)" };
  }
  const pct = ((atual - anterior) / Math.abs(anterior)) * 100;
  const positivo = inverter ? pct <= 0 : pct >= 0;
  const cor = positivo ? "var(--color-success)" : "var(--color-danger)";
  return { texto: `${pct >= 0 ? "↑" : "↓"} ${Math.abs(pct).toFixed(0)}% vs mês anterior`, cor };
}

type CartaoAberto =
  | { tipo: "indicador"; titulo: string; indicador: IndicadorFinanceiro }
  | { tipo: "memoria"; titulo: string; linhas: { label: string; valor: number; destaque?: boolean }[] }
  | null;

export default function VisaoGeralPessoalClient({
  dados,
  ano,
  mes,
  hoje,
}: {
  dados: DadosVisaoGeralPessoal | null;
  ano: number;
  mes: number;
  hoje: string;
}) {
  const [aberto, setAberto] = useState<CartaoAberto>(null);
  const mesLabel = `${MESES[mes - 1]}/${ano}`;

  const hojeDate = useMemo(() => new Date(hoje + "T00:00:00"), [hoje]);
  const [cal, setCal] = useState({ year: hojeDate.getFullYear(), month: hojeDate.getMonth() });
  const [selectedDate, setSelectedDate] = useState(hoje);

  const eventosPorDia = useMemo(
    () => (dados ? eventosDoCalendarioPessoal(dados.despesas, dados.receitas, cal.year, cal.month, hoje) : {}),
    [dados, cal, hoje]
  );
  const cells = useMemo(() => buildMonthGrid(cal.year, cal.month, hoje, selectedDate, eventosPorDia), [cal, hoje, selectedDate, eventosPorDia]);
  const monthLabel = cap(new Date(cal.year, cal.month, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }));
  const selectedDateLabel = cap(
    new Date(selectedDate + "T00:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })
  );
  const selectedDayEvents = eventosPorDia[selectedDate] ?? [];
  function prevMonth() {
    setCal((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }));
  }
  function nextMonth() {
    setCal((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }));
  }
  function goToday() {
    setCal({ year: hojeDate.getFullYear(), month: hojeDate.getMonth() });
    setSelectedDate(hoje);
  }

  if (!dados) return null;

  return (
    <div>
      <div
        className="mb-5 cursor-pointer rounded-card border border-border-gold bg-card p-5"
        onClick={() =>
          setAberto({
            tipo: "memoria",
            titulo: "Patrimônio líquido",
            linhas: [
              { label: "Saldo disponível nas contas", valor: dados.saldoDisponivel },
              { label: "Total investido", valor: dados.totalInvestido },
              { label: "Dívidas ativas (saldo devedor)", valor: -dados.totalDividas },
              { label: "Faturas de cartão em aberto", valor: -dados.faturasEmAberto },
              { label: "Patrimônio líquido", valor: dados.patrimonioLiquido, destaque: true },
            ],
          })
        }
      >
        <p className="text-[10.5px] tracking-wide text-text-muted uppercase">Patrimônio líquido</p>
        <p className={`font-display text-2xl font-bold ${dados.patrimonioLiquido >= 0 ? "text-gradient-gold" : "text-danger"}`}>
          {fmtBRL(dados.patrimonioLiquido)}
        </p>
        <p className="mt-1 text-[11px] text-text-muted">
          Contas + investimentos − dívidas − faturas em aberto · clique pra ver a memória de cálculo
        </p>
      </div>

      <div className="mb-1 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <IndicadorCard
            titulo="Receitas recebidas no mês"
            valor={dados.recebido.total}
            quantidade={dados.recebido.quantidade}
            mesLabel={mesLabel}
            tom="bom"
            onClick={() => setAberto({ tipo: "indicador", titulo: "Receitas recebidas no mês", indicador: dados.recebido })}
          />
          <p className="mt-1 text-[11px]" style={{ color: deltaTexto(dados.recebido.total, dados.comparacaoMesAnterior.recebido).cor }}>
            {deltaTexto(dados.recebido.total, dados.comparacaoMesAnterior.recebido).texto}
          </p>
        </div>
        <IndicadorCard
          titulo="Receitas previstas em aberto"
          valor={dados.aReceber.total}
          quantidade={dados.aReceber.quantidade}
          mesLabel={mesLabel}
          onClick={() => setAberto({ tipo: "indicador", titulo: "Receitas previstas em aberto", indicador: dados.aReceber })}
        />
        <IndicadorCard
          titulo="Compromissos vencidos (receber)"
          valor={dados.aReceber.vencidos.reduce((s, r) => s + r.valor, 0)}
          quantidade={dados.aReceber.vencidos.length}
          mesLabel="Até hoje"
          tom={dados.aReceber.vencidos.length > 0 ? "atencao" : "neutro"}
          onClick={() =>
            setAberto({
              tipo: "indicador",
              titulo: "Receitas vencidas",
              indicador: { ...dados.aReceber, registros: dados.aReceber.vencidos, total: dados.aReceber.vencidos.reduce((s, r) => s + r.valor, 0), quantidade: dados.aReceber.vencidos.length },
            })
          }
        />
        <div>
          <IndicadorCard
            titulo="Saídas pagas no mês"
            valor={dados.pago.total}
            quantidade={dados.pago.quantidade}
            mesLabel={mesLabel}
            onClick={() => setAberto({ tipo: "indicador", titulo: "Saídas pagas no mês", indicador: dados.pago })}
          />
          <p className="mt-1 text-[11px]" style={{ color: deltaTexto(dados.pago.total, dados.comparacaoMesAnterior.pago, true).cor }}>
            {deltaTexto(dados.pago.total, dados.comparacaoMesAnterior.pago, true).texto}
          </p>
        </div>
        <IndicadorCard
          titulo="Compromissos a pagar no mês"
          valor={dados.aPagar.total}
          quantidade={dados.aPagar.quantidade}
          mesLabel={mesLabel}
          onClick={() => setAberto({ tipo: "indicador", titulo: "Compromissos a pagar no mês", indicador: dados.aPagar })}
        />
        <IndicadorCard
          titulo="Compromissos vencidos (pagar)"
          valor={dados.aPagar.vencidos.reduce((s, r) => s + r.valor, 0)}
          quantidade={dados.aPagar.vencidos.length}
          mesLabel="Até hoje"
          tom={dados.aPagar.vencidos.length > 0 ? "atencao" : "neutro"}
          onClick={() =>
            setAberto({
              tipo: "indicador",
              titulo: "Despesas vencidas",
              indicador: { ...dados.aPagar, registros: dados.aPagar.vencidos, total: dados.aPagar.vencidos.reduce((s, r) => s + r.valor, 0), quantidade: dados.aPagar.vencidos.length },
            })
          }
        />
      </div>

      <div className="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <IndicadorCard
            titulo="Resultado de caixa realizado"
            valor={dados.resultadoRealizado}
            mesLabel={mesLabel}
            tom={dados.resultadoRealizado >= 0 ? "bom" : "atencao"}
            onClick={() =>
              setAberto({
                tipo: "memoria",
                titulo: "Resultado de caixa realizado",
                linhas: [
                  { label: "Receitas recebidas", valor: dados.recebido.total },
                  { label: "Saídas pagas", valor: dados.pago.total },
                  { label: "Resultado de caixa realizado", valor: dados.resultadoRealizado, destaque: true },
                ],
              })
            }
          />
          <p
            className="mt-1 text-[11px]"
            style={{ color: deltaTexto(dados.resultadoRealizado, dados.comparacaoMesAnterior.resultadoRealizado).cor }}
          >
            {deltaTexto(dados.resultadoRealizado, dados.comparacaoMesAnterior.resultadoRealizado).texto} (
            {fmtBRL(dados.comparacaoMesAnterior.resultadoRealizado)} no mês passado)
          </p>
        </div>
        <div className="flex flex-col items-start gap-1 rounded-card border border-border-neutral bg-card p-4">
          <p className="text-[10.5px] tracking-wide text-text-muted uppercase">Saldo disponível nas contas</p>
          <p className="font-display text-xl font-bold text-gradient-gold">{fmtBRL(dados.saldoDisponivel)}</p>
          <p className="text-[11px] text-text-muted">
            {dados.contasComSaldoConhecido ? "Posição atual — não é um número do mês" : "Cadastre uma conta pra ver o saldo aqui"}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col items-start gap-1 rounded-card border border-border-neutral bg-card p-4">
          <p className="text-[10.5px] tracking-wide text-text-muted uppercase">Total investido</p>
          <p className="font-display text-lg font-bold text-text">{fmtBRL(dados.totalInvestido)}</p>
          <p className="text-[11px] text-text-muted">Posição atual, todos os investimentos ativos</p>
        </div>
        <div className="flex flex-col items-start gap-1 rounded-card border border-border-neutral bg-card p-4">
          <p className="text-[10.5px] tracking-wide text-text-muted uppercase">Dívidas ativas</p>
          <p className={`font-display text-lg font-bold ${dados.totalDividas > 0 ? "text-danger" : "text-text"}`}>
            {fmtBRL(dados.totalDividas)}
          </p>
          <p className="text-[11px] text-text-muted">Saldo devedor atual</p>
        </div>
        <div className="flex flex-col items-start gap-1 rounded-card border border-border-neutral bg-card p-4">
          <p className="text-[10.5px] tracking-wide text-text-muted uppercase">Faturas de cartão em aberto</p>
          <p className={`font-display text-lg font-bold ${dados.faturasEmAberto > 0 ? "text-danger" : "text-text"}`}>
            {fmtBRL(dados.faturasEmAberto)}
          </p>
          <p className="text-[11px] text-text-muted">Compras já feitas, fatura ainda não paga</p>
        </div>
      </div>

      {(dados.compromissosProximos.length > 0 || dados.receitasProximas.length > 0) && (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {dados.compromissosProximos.length > 0 && (
            <div className="rounded-card border border-border-neutral bg-card p-4">
              <p className="mb-2 text-[10.5px] tracking-wide text-text-muted uppercase">
                Compromissos próximos (7 dias)
              </p>
              <div className="flex flex-col gap-1">
                {dados.compromissosProximos.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-[12.5px]">
                    <span className="text-text-secondary">
                      {fmtDatePtBR(r.data)} · {r.descricao}
                    </span>
                    <span className="font-semibold">{fmtBRL(r.valor)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {dados.receitasProximas.length > 0 && (
            <div className="rounded-card border border-border-neutral bg-card p-4">
              <p className="mb-2 text-[10.5px] tracking-wide text-text-muted uppercase">Receitas próximas (7 dias)</p>
              <div className="flex flex-col gap-1">
                {dados.receitasProximas.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-[12.5px]">
                    <span className="text-text-secondary">
                      {fmtDatePtBR(r.data)} · {r.descricao}
                    </span>
                    <span className="font-semibold text-success">{fmtBRL(r.valor)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-5 rounded-card border border-border-neutral bg-card-secondary p-5">
        <p className="mb-4 font-display text-[15px] font-bold text-text">Evolução mensal — 12 meses</p>
        <BarChart
          series={[
            { key: "recebido", label: "Recebido", color: "var(--color-gold)" },
            { key: "pago", label: "Pago", color: "var(--color-text-muted)" },
          ]}
          data={dados.serieMensal12.map((m) => ({ label: m.label, values: [m.recebido, m.pago] }))}
          fmt={fmtBRL}
        />
      </div>

      <div className="mt-5">
        <p className="mb-3 font-display text-[15px] font-bold text-text">Calendário financeiro pessoal</p>
        <CalendarioView
          monthLabel={monthLabel}
          cells={cells}
          onPrev={prevMonth}
          onNext={nextMonth}
          onToday={goToday}
          onSelectDay={setSelectedDate}
          selectedDateLabel={selectedDateLabel}
          selectedDayEvents={selectedDayEvents}
          painelTitulo="Compromissos do dia"
        />
      </div>

      {aberto?.tipo === "indicador" && (
        <DetalhamentoIndicadorModal titulo={aberto.titulo} indicador={aberto.indicador} onClose={() => setAberto(null)} />
      )}
      {aberto?.tipo === "memoria" && (
        <DetalhamentoIndicadorModal titulo={aberto.titulo} memoria={aberto.linhas} onClose={() => setAberto(null)} />
      )}
    </div>
  );
}

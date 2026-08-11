"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  Cliente,
  Comprovante,
  DespesaFixa,
  DespesaFixaOcorrencia,
  Evento,
  Fornecedor,
  ItemOrcamento,
  Lancamento,
  OrcamentoItemRow,
  Servico,
} from "@/lib/domain/types";
import {
  buildMonthGrid,
  compararMeses,
  despesasPorCategoria,
  eventosDoCalendario,
  historico12Meses,
  kpisVisaoGeral,
  monthlySeries,
  mtdComparativo,
  proximosEventos,
  topClientesGeral,
  topItensCatalogo,
  vendasPorTipo,
  type Meta,
  type MetaTipo,
} from "@/lib/domain/dashboardMetrics";
import VisaoGeralView from "./VisaoGeralView";
import VendasView from "./VendasView";
import DespesasView from "./DespesasView";
import ComparativoView from "./ComparativoView";
import HistoricoView from "./HistoricoView";
import CalendarioView from "./CalendarioView";
import ClientesView from "./ClientesView";
import MetasView from "./MetasView";
import GargalosView from "./GargalosView";
import RelatoriosClient from "@/components/relatorios/RelatoriosClient";

const TABS = [
  { key: "overview", label: "Visão Geral" },
  { key: "sales", label: "Vendas" },
  { key: "expenses", label: "Despesas" },
  { key: "compare", label: "Comparativo" },
  { key: "history", label: "Histórico" },
  { key: "calendar", label: "Calendário" },
  { key: "clients", label: "Clientes" },
  { key: "goals", label: "Metas" },
  { key: "gargalos", label: "Gargalos" },
  { key: "relatorios", label: "Relatórios" },
];

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function DashboardShell({
  hojeISO,
  servicos,
  clientes,
  lancamentos,
  eventos,
  despesasFixas,
  despesasFixasOcorrencias,
  orcamentoItens,
  itensOrcamento,
  metas,
  fornecedores,
  comprovantes,
}: {
  hojeISO: string;
  servicos: Servico[];
  clientes: Cliente[];
  lancamentos: Lancamento[];
  eventos: Evento[];
  despesasFixas: DespesaFixa[];
  despesasFixasOcorrencias: DespesaFixaOcorrencia[];
  orcamentoItens: OrcamentoItemRow[];
  itensOrcamento: ItemOrcamento[];
  metas: Meta[];
  fornecedores: Fornecedor[];
  comprovantes: Comprovante[];
}) {
  const router = useRouter();
  const hoje = useMemo(() => new Date(hojeISO + "T00:00:00"), [hojeISO]);

  const [view, setView] = useState("overview");
  const [cal, setCal] = useState({ year: hoje.getFullYear(), month: hoje.getMonth() });
  const [selectedDate, setSelectedDate] = useState(hojeISO);

  // 25 meses = mês atual + 24 pra trás — dá pra navegar uns 2 anos pro passado no painel
  // estratégico (Visão Geral/Vendas/Despesas), sem precisar recalcular a série a cada clique.
  const monthly = useMemo(() => monthlySeries(lancamentos, hoje, 25), [lancamentos, hoje]);
  const [compareA, setCompareA] = useState(Math.max(0, monthly.length - 2));
  const [compareB, setCompareB] = useState(monthly.length - 1);

  // Mês navegável, compartilhado entre Visão Geral/Vendas/Despesas — independente do
  // calendário (que navega por dia, não por mês de referência dos KPIs).
  const [viewIdx, setViewIdx] = useState(monthly.length - 1);
  const isMesAtual = viewIdx === monthly.length - 1;
  const mesAtual = monthly[viewIdx];
  const mesAnterior = viewIdx > 0 ? monthly[viewIdx - 1] : null;
  const viewMonthLabel = cap(
    new Date(mesAtual.year, mesAtual.month, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
  );
  function prevViewMonth() {
    setViewIdx((i) => Math.max(0, i - 1));
  }
  function nextViewMonth() {
    setViewIdx((i) => Math.min(monthly.length - 1, i + 1));
  }

  const kpis = useMemo(() => kpisVisaoGeral(monthly, metas, viewIdx), [monthly, metas, viewIdx]);
  const mtd = useMemo(
    () => (isMesAtual ? mtdComparativo(lancamentos, hoje.getFullYear(), hoje.getMonth(), hoje.getDate()) : null),
    [isMesAtual, lancamentos, hoje]
  );
  const upcoming = useMemo(
    () => proximosEventos(eventos, despesasFixas, despesasFixasOcorrencias, lancamentos, hojeISO),
    [eventos, despesasFixas, despesasFixasOcorrencias, lancamentos, hojeISO]
  );
  const topClientes = useMemo(() => topClientesGeral(servicos, clientes, 4), [servicos, clientes]);

  const numPedidosMes = useMemo(
    () => servicos.filter((s) => s.criado_em.slice(0, 7) === mesAtual.key).length,
    [servicos, mesAtual]
  );
  const mesAtualRefDate = useMemo(() => new Date(mesAtual.year, mesAtual.month, 1), [mesAtual]);
  const porTipo = useMemo(() => vendasPorTipo(servicos, mesAtualRefDate), [servicos, mesAtualRefDate]);
  const topItens = useMemo(() => topItensCatalogo(orcamentoItens, itensOrcamento), [orcamentoItens, itensOrcamento]);

  const porCategoria = useMemo(
    () => despesasPorCategoria(lancamentos, mesAtualRefDate),
    [lancamentos, mesAtualRefDate]
  );
  const ultimosLancamentosDespesa = useMemo(
    () =>
      lancamentos
        .filter((l) => l.tipo === "Despesa")
        .sort((a, b) => b.data.localeCompare(a.data))
        .slice(0, 8),
    [lancamentos]
  );

  const compareBars = useMemo(() => compararMeses(monthly, compareA, compareB), [monthly, compareA, compareB]);
  const historicoRows = useMemo(() => historico12Meses(monthly.slice(-12)), [monthly]);

  const eventosPorDia = useMemo(
    () => eventosDoCalendario(eventos, despesasFixas, despesasFixasOcorrencias, lancamentos, cal.year, cal.month),
    [eventos, despesasFixas, despesasFixasOcorrencias, lancamentos, cal]
  );
  const cells = useMemo(
    () => buildMonthGrid(cal.year, cal.month, hojeISO, selectedDate, eventosPorDia),
    [cal, hojeISO, selectedDate, eventosPorDia]
  );
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
    setCal({ year: hoje.getFullYear(), month: hoje.getMonth() });
    setSelectedDate(hojeISO);
  }

  // Metas sempre olham pro mês corrente de verdade (não pro mês navegado em Visão
  // Geral/Vendas/Despesas) — "como estou indo esse mês" não deve mudar se o usuário só
  // deu uma olhada em Março numa aba diferente.
  const mesCorrente = monthly[monthly.length - 1];
  const kpisCorrente = useMemo(() => kpisVisaoGeral(monthly, metas), [monthly, metas]);
  const atuais: Record<MetaTipo, number> = {
    vendas_mensais: mesCorrente.sales,
    despesas_mensais: mesCorrente.expenses,
    novos_clientes: clientes.filter((c) => c.created_at.slice(0, 7) === mesCorrente.key).length,
    margem_liquida: kpisCorrente.margem.value,
  };

  return (
    <div>
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-border-neutral">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setView(t.key)}
            className={`shrink-0 rounded-t-btn px-3.5 py-2.5 text-[13px] ${
              view === t.key ? "border-b-2 border-gold font-semibold text-gold" : "text-text-secondary hover:text-text"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {view === "overview" && (
        <VisaoGeralView
          kpis={kpis}
          monthly6={monthly.slice(-6)}
          monthly12={monthly.slice(-12)}
          upcoming={upcoming}
          topClientes={topClientes}
          monthLabel={viewMonthLabel}
          isMesAtual={isMesAtual}
          onPrevMonth={prevViewMonth}
          onNextMonth={nextViewMonth}
          disableNext={viewIdx === monthly.length - 1}
          mtd={mtd}
        />
      )}
      {view === "sales" && (
        <VendasView
          mesAtual={mesAtual}
          mesAnterior={mesAnterior}
          numPedidos={numPedidosMes}
          monthly12={monthly.slice(-12)}
          porTipo={porTipo}
          topItens={topItens}
          monthLabel={viewMonthLabel}
          isMesAtual={isMesAtual}
          onPrevMonth={prevViewMonth}
          onNextMonth={nextViewMonth}
          disableNext={viewIdx === monthly.length - 1}
        />
      )}
      {view === "expenses" && (
        <DespesasView
          mesAtual={mesAtual}
          mesAnterior={mesAnterior}
          monthly12={monthly.slice(-12)}
          porCategoria={porCategoria}
          ultimosLancamentos={ultimosLancamentosDespesa}
          monthLabel={viewMonthLabel}
          isMesAtual={isMesAtual}
          onPrevMonth={prevViewMonth}
          onNextMonth={nextViewMonth}
          disableNext={viewIdx === monthly.length - 1}
        />
      )}
      {view === "compare" && (
        <ComparativoView monthly={monthly} indexA={compareA} indexB={compareB} onChangeA={setCompareA} onChangeB={setCompareB} compareBars={compareBars} />
      )}
      {view === "history" && <HistoricoView rows={historicoRows} />}
      {view === "calendar" && (
        <CalendarioView
          monthLabel={monthLabel}
          cells={cells}
          onPrev={prevMonth}
          onNext={nextMonth}
          onToday={goToday}
          onSelectDay={setSelectedDate}
          selectedDate={selectedDate}
          selectedDateLabel={selectedDateLabel}
          selectedDayEvents={selectedDayEvents}
        />
      )}
      {view === "clients" && <ClientesView clientes={clientes} servicos={servicos} />}
      {view === "goals" && <MetasView metas={metas} atuais={atuais} onChanged={() => router.refresh()} />}
      {view === "gargalos" && <GargalosView servicos={servicos} comprovantes={comprovantes} />}
      {view === "relatorios" && (
        <RelatoriosClient
          servicos={servicos}
          clientes={clientes}
          lancamentos={lancamentos}
          fornecedores={fornecedores}
        />
      )}
    </div>
  );
}

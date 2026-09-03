"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  Cliente,
  Comprovante,
  DespesaFixa,
  DespesaFixaOcorrencia,
  DespesaVariavel,
  DespesaVariavelOcorrencia,
  Evento,
  FechamentoMensal,
  Fornecedor,
  ItemOrcamento,
  Lancamento,
  OrcamentoItemRow,
  Servico,
  ServicoParcela,
} from "@/lib/domain/types";
import {
  buildMonthGrid,
  compararMeses,
  despesasPorCategoria,
  eventosDoCalendario,
  historico12Meses,
  kpisVisaoGeral,
  mtdComparativo,
  proximosEventos,
  topClientesGeral,
  topItensCatalogo,
  vendasPorTipo,
  type Meta,
  type MetaTipo,
} from "@/lib/domain/dashboardMetrics";
import {
  aPagar,
  aReceber,
  despesasPagas,
  excluirPrevistosDeServicoCancelado,
  periodoDoMes,
  recebido,
  resultadoPendente,
  resultadoPrevistoFinal,
  resultadoRealizado,
  serieMensalOficial,
  vendasAprovadas,
  type IndicadorComVencidos,
  type IndicadorFinanceiro,
} from "@/lib/domain/financas";
import { emProducao, atrasados } from "@/lib/domain/kpis";
import { propostasAguardandoResposta, propostasVencidas } from "@/lib/domain/comercial";
import type { DadosVisaoGeral } from "@/components/financeiro/VisaoGeralFinanceiroClient";
import VisaoGeralView from "./VisaoGeralView";
import VendasView from "./VendasView";
import DespesasView from "./DespesasView";
import ComparativoView from "./ComparativoView";
import HistoricoView from "./HistoricoView";
import CalendarioView from "./CalendarioView";
import ClientesView from "./ClientesView";
import MetasView from "./MetasView";
import GargalosView from "./GargalosView";
import ConferenciaView from "./ConferenciaView";
import UsuariosView from "./UsuariosView";
import RelatoriosClient from "@/components/relatorios/RelatoriosClient";
import type { Profile } from "@/lib/supabase/profile";

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
  { key: "conferencia", label: "Conferência" },
  { key: "usuarios", label: "Usuários" },
];

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Os cartões "Recebimentos vencidos"/"Despesas vencidas" mostram só o vencido, não o total do
 * mês inteiro usado internamente pra encontrá-los — mesmo padrão de `financeiro/visao-geral`. */
function comoIndicadorDeVencidos(ind: IndicadorComVencidos): IndicadorFinanceiro {
  const registros = ind.vencidos;
  return {
    ...ind,
    registros,
    total: registros.reduce((s, r) => s + r.valor, 0),
    quantidade: registros.length,
  };
}

/** Empacota uma lista de OS (Servico[]) no mesmo envelope `IndicadorFinanceiro` que os 9
 * cartões financeiros já usam — reaproveita o card+modal existentes em vez de criar um
 * componente novo só pra "OS abertas"/"OS atrasadas". */
function comoIndicadorDeServicos(servicos: Servico[], criterioData: string): IndicadorFinanceiro {
  const registros = servicos.map((s) => ({
    id: s.id,
    descricao: `${s.numero ?? "—"} — ${s.cliente}`,
    valor: s.valor,
    data: s.prazo ?? s.aprovado_em ?? s.criado_em,
  }));
  return {
    total: registros.reduce((sum, r) => sum + r.valor, 0),
    quantidade: registros.length,
    registros,
    periodo: { inicio: "", fim: "" },
    criterioData,
    statusConsiderados: [],
    statusExcluidos: [],
  };
}

/** Mesma ideia, pras listas já vindas prontas de `comercial.ts` (RegistroComercial já tem o
 * mesmo formato de RegistroIndicador — id/descricao/valor/data). */
function comoIndicadorDeRegistros(
  registros: { id: string; descricao: string; valor: number; data: string }[],
  criterioData: string
): IndicadorFinanceiro {
  return {
    total: registros.reduce((sum, r) => sum + r.valor, 0),
    quantidade: registros.length,
    registros,
    periodo: { inicio: "", fim: "" },
    criterioData,
    statusConsiderados: [],
    statusExcluidos: [],
  };
}

export default function DashboardShell({
  hojeISO,
  servicos,
  clientes,
  lancamentos,
  eventos,
  despesasFixas,
  despesasFixasOcorrencias,
  despesasVariaveis,
  despesasVariaveisOcorrencias,
  servicoParcelas,
  orcamentoItens,
  itensOrcamento,
  metas,
  fornecedores,
  comprovantes,
  fechamentos,
  usuarios,
}: {
  hojeISO: string;
  servicos: Servico[];
  clientes: Cliente[];
  lancamentos: Lancamento[];
  eventos: Evento[];
  despesasFixas: DespesaFixa[];
  despesasFixasOcorrencias: DespesaFixaOcorrencia[];
  despesasVariaveis: DespesaVariavel[];
  despesasVariaveisOcorrencias: DespesaVariavelOcorrencia[];
  servicoParcelas: ServicoParcela[];
  orcamentoItens: OrcamentoItemRow[];
  itensOrcamento: ItemOrcamento[];
  metas: Meta[];
  fornecedores: Fornecedor[];
  comprovantes: Comprovante[];
  fechamentos: FechamentoMensal[];
  usuarios: Profile[];
}) {
  const router = useRouter();
  const hoje = useMemo(() => new Date(hojeISO + "T00:00:00"), [hojeISO]);

  const [view, setView] = useState("overview");
  const [cal, setCal] = useState({ year: hoje.getFullYear(), month: hoje.getMonth() });
  const [selectedDate, setSelectedDate] = useState(hojeISO);

  // 25 meses = mês atual + 24 pra trás — dá pra navegar uns 2 anos pro passado no painel
  // estratégico (Visão Geral/Vendas/Despesas), sem precisar recalcular a série a cada clique.
  const monthly = useMemo(() => serieMensalOficial(lancamentos, hoje, 25), [lancamentos, hoje]);
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
  // Faturamento = valor das OS aprovadas no mês (regra oficial `vendasAprovadas`, Etapa 2) —
  // exclui Cancelado e usa o fuso da operação, não `.slice(0,7)` cru no timestamp. Diferente
  // da Receita (que só soma o que já foi realmente recebido) já mostrada nos KPIs em anel.
  const faturamentoMes = useMemo(
    () => vendasAprovadas(servicos, periodoDoMes(mesAtual.year, mesAtual.month + 1)).total,
    [servicos, mesAtual]
  );

  // Indicadores oficiais da Etapa 2 (mesmas funções de `financas.ts` que o Financeiro usa),
  // escopados ao mês navegado aqui em Gestão — nunca recalculados na tela, só chamados.
  const periodoMes = useMemo(() => periodoDoMes(mesAtual.year, mesAtual.month + 1), [mesAtual]);
  const lancamentosPrevistos = useMemo(
    () => excluirPrevistosDeServicoCancelado(lancamentos.filter((l) => l.status === "previsto"), servicos),
    [lancamentos, servicos]
  );
  const lancsReceitaPrevisto = useMemo(() => lancamentosPrevistos.filter((l) => l.tipo === "Receita"), [lancamentosPrevistos]);
  const lancsDespesaPrevisto = useMemo(() => lancamentosPrevistos.filter((l) => l.tipo === "Despesa"), [lancamentosPrevistos]);
  const ocorrenciasFixasDoMes = useMemo(
    () => despesasFixasOcorrencias.filter((o) => o.ano === mesAtual.year && o.mes === mesAtual.month + 1),
    [despesasFixasOcorrencias, mesAtual]
  );
  const ocorrenciasVariaveisDoMes = useMemo(
    () => despesasVariaveisOcorrencias.filter((o) => o.ano === mesAtual.year && o.mes === mesAtual.month + 1),
    [despesasVariaveisOcorrencias, mesAtual]
  );

  const recebidoInd = useMemo(() => recebido(lancamentos, periodoMes), [lancamentos, periodoMes]);
  const despesasPagasInd = useMemo(() => despesasPagas(lancamentos, periodoMes), [lancamentos, periodoMes]);
  const aReceberInd = useMemo(
    () => aReceber(servicos, servicoParcelas, lancsReceitaPrevisto, periodoMes, hojeISO),
    [servicos, servicoParcelas, lancsReceitaPrevisto, periodoMes, hojeISO]
  );
  const aPagarInd = useMemo(
    () =>
      aPagar(
        despesasFixas,
        ocorrenciasFixasDoMes,
        despesasVariaveis,
        ocorrenciasVariaveisDoMes,
        lancsDespesaPrevisto,
        periodoMes,
        hojeISO
      ),
    [despesasFixas, ocorrenciasFixasDoMes, despesasVariaveis, ocorrenciasVariaveisDoMes, lancsDespesaPrevisto, periodoMes, hojeISO]
  );
  const dadosIndicadores: DadosVisaoGeral = useMemo(
    () => ({
      recebido: recebidoInd,
      despesasPagas: despesasPagasInd,
      aReceber: aReceberInd,
      recebimentosVencidos: comoIndicadorDeVencidos(aReceberInd),
      aPagar: aPagarInd,
      despesasVencidas: comoIndicadorDeVencidos(aPagarInd),
      resultadoRealizado: resultadoRealizado(recebidoInd.total, despesasPagasInd.total),
      resultadoPendente: resultadoPendente(aReceberInd.total, aPagarInd.total),
      resultadoPrevistoFinal: resultadoPrevistoFinal(
        recebidoInd.total,
        aReceberInd.total,
        despesasPagasInd.total,
        aPagarInd.total
      ),
      osAbertas: comoIndicadorDeServicos(emProducao(servicos), "OS aprovada, ainda não concluída"),
      osAtrasadas: comoIndicadorDeServicos(
        atrasados(servicos).filter((s) => s.numero != null),
        "OS aprovada, prazo já vencido, ainda não concluída"
      ),
      propostasAguardando: comoIndicadorDeRegistros(
        propostasAguardandoResposta(servicos),
        "Proposta enviada, cliente ainda não respondeu"
      ),
      propostasVencidas: comoIndicadorDeRegistros(
        propostasVencidas(servicos, hojeISO),
        "Proposta enviada, validade já passou, sem resposta"
      ),
    }),
    [recebidoInd, despesasPagasInd, aReceberInd, aPagarInd, servicos, hojeISO]
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
          faturamentoMes={faturamentoMes}
          dadosIndicadores={dadosIndicadores}
          ano={mesAtual.year}
          mes={mesAtual.month + 1}
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
          selectedDateLabel={selectedDateLabel}
          selectedDayEvents={selectedDayEvents}
          agendaHref={`/producao/agenda?data=${selectedDate}`}
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
      {view === "conferencia" && <ConferenciaView fechamentos={fechamentos} />}
      {view === "usuarios" && <UsuariosView usuarios={usuarios} />}
    </div>
  );
}

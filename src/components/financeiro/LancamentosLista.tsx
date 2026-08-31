"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { Fornecedor, Lancamento, ServicoParaVinculo } from "@/lib/domain/types";
import { fmtBRL } from "@/lib/domain/types";
import { marcarLancamentoRealizado, cancelarLancamento, estornarLancamento } from "@/lib/actions/financeiro";
import { recebido, despesasPagas, situacaoLancamento, type SituacaoLancamento } from "@/lib/domain/financas";
import { hojeISOOperacao } from "@/lib/domain/dates";
import { normalizarBusca } from "@/lib/domain/texto";
import NovoLancamentoModal from "./NovoLancamentoModal";

const SITUACAO_LABEL: Record<SituacaoLancamento, string> = {
  previsto: "Previsto",
  parcial: "Parcial",
  realizado: "Realizado",
  a_vencer: "A vencer",
  vencido: "Vencido",
  cancelado: "Cancelado",
};

const SITUACAO_COR: Record<SituacaoLancamento, string> = {
  previsto: "#E0A64E",
  parcial: "#E0A64E",
  realizado: "#25D366",
  a_vencer: "#8a6ba0",
  vencido: "#E07A7A",
  cancelado: "#8a8378",
};

function fmtDiaLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmtMesAno(ano: number, mes: number): string {
  return capitalizar(new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }));
}

/** Histórico de lançamentos agrupado por dia, com filtros combináveis e clique pra editar —
 * usado tanto em Lançamentos (tudo) quanto em Despesas (só o que é tipo Despesa). O filtro de
 * mês vem do servidor (URL) — aqui só os filtros extras (tipo, situação, categoria, etc). */
export default function LancamentosLista({
  lancamentos,
  fornecedores,
  servicos = [],
  vazioLabel = "Nenhum lançamento ainda.",
  geral = false,
  ano,
  mes,
}: {
  lancamentos: Lancamento[];
  fornecedores: Fornecedor[];
  servicos?: ServicoParaVinculo[];
  vazioLabel?: string;
  geral?: boolean;
  ano?: number;
  mes?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hoje = hojeISOOperacao();
  const [editing, setEditing] = useState<Lancamento | null>(null);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "Receita" | "Despesa">("todos");
  const [filtroSituacao, setFiltroSituacao] = useState<"todas" | SituacaoLancamento>("todas");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroFornecedor, setFiltroFornecedor] = useState("todos");
  const [filtroForma, setFiltroForma] = useState("todas");
  const [filtroOS, setFiltroOS] = useState("");

  const fornecedorNome = (id: string | null) => fornecedores.find((f) => f.id === id)?.nome ?? null;
  const servicoDoLancamento = (servicoId: string | null) => servicos.find((s) => s.id === servicoId) ?? null;

  const categorias = useMemo(
    () => Array.from(new Set(lancamentos.map((l) => l.categoria).filter((c): c is string => !!c))).sort(),
    [lancamentos]
  );
  const formasPagamento = useMemo(
    () => Array.from(new Set(lancamentos.map((l) => l.forma_pagamento).filter((f): f is string => !!f))).sort(),
    [lancamentos]
  );

  function toggleHistoricoGeral() {
    const params = new URLSearchParams(searchParams.toString());
    if (geral) {
      params.delete("geral");
    } else {
      params.set("geral", "1");
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function limparFiltros() {
    setBusca("");
    setFiltroTipo("todos");
    setFiltroSituacao("todas");
    setFiltroCategoria("todas");
    setFiltroFornecedor("todos");
    setFiltroForma("todas");
    setFiltroOS("");
  }

  const filtrosAtivos =
    busca || filtroTipo !== "todos" || filtroSituacao !== "todas" || filtroCategoria !== "todas" || filtroFornecedor !== "todos" || filtroForma !== "todas" || filtroOS;

  const filtrados = useMemo(() => {
    const alvoBusca = busca.trim() ? normalizarBusca(busca) : null;
    const alvoOS = filtroOS.trim() ? normalizarBusca(filtroOS) : null;
    return lancamentos.filter((l) => {
      const situacao = situacaoLancamento(l.status, l.data, hoje);
      // Cancelado só aparece quando explicitamente pedido — nunca por padrão, e sempre fora
      // dos totais (já garantido por `recebido`/`despesasPagas`, que só somam 'realizado').
      if (situacao === "cancelado" && filtroSituacao !== "cancelado") return false;
      if (filtroTipo !== "todos" && l.tipo !== filtroTipo) return false;
      if (filtroSituacao !== "todas" && situacao !== filtroSituacao) return false;
      if (filtroCategoria !== "todas" && l.categoria !== filtroCategoria) return false;
      if (filtroFornecedor !== "todos" && l.fornecedor_id !== filtroFornecedor) return false;
      if (filtroForma !== "todas" && l.forma_pagamento !== filtroForma) return false;
      if (alvoOS) {
        const sv = servicos.find((s) => s.id === l.servico_id);
        if (!sv || !normalizarBusca(sv.numero ?? "").includes(alvoOS)) return false;
      }
      if (alvoBusca) {
        const nomeFornecedor = fornecedores.find((f) => f.id === l.fornecedor_id)?.nome ?? "";
        const campos = [l.descricao, l.categoria ?? "", nomeFornecedor];
        if (!campos.some((c) => normalizarBusca(c).includes(alvoBusca))) return false;
      }
      return true;
    });
  }, [lancamentos, busca, filtroTipo, filtroSituacao, filtroCategoria, filtroFornecedor, filtroForma, filtroOS, hoje, servicos, fornecedores]);

  const somaFiltrados = useMemo(() => {
    const periodo = { inicio: "0000-01-01", fim: "9999-12-31" };
    return recebido(filtrados, periodo).total - despesasPagas(filtrados, periodo).total;
  }, [filtrados]);

  const grupos = useMemo(() => {
    const map = new Map<string, Lancamento[]>();
    for (const l of filtrados) {
      map.set(l.data, [...(map.get(l.data) ?? []), l]);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtrados]);

  async function handleCancelar(l: Lancamento) {
    const motivo = prompt("Motivo do cancelamento (opcional):");
    if (motivo === null) return;
    const resultado = await cancelarLancamento(l.id, motivo || null);
    if (!resultado.ok) {
      setError(resultado.message);
    } else {
      router.refresh();
    }
  }

  async function handleEstornar(l: Lancamento) {
    const motivo = prompt("Motivo do estorno (opcional):");
    if (motivo === null) return;
    const resultado = await estornarLancamento(l.id, motivo || null);
    if (!resultado.ok) {
      setError(resultado.message);
    } else {
      router.refresh();
    }
  }

  return (
    <div>
      {error && (
        <p className="mb-3 rounded-btn border border-danger-border bg-card-secondary px-3 py-2 text-[12.5px] text-danger">
          {error}
        </p>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[12.5px] font-semibold">
          {geral ? "Histórico geral — não limitado ao mês selecionado" : ano && mes ? fmtMesAno(ano, mes) : ""}
        </span>
        <button
          type="button"
          onClick={toggleHistoricoGeral}
          className={`rounded-btn border px-3 py-1.5 text-[12px] ${
            geral ? "border-gold bg-gold/10 text-gold" : "border-border-neutral text-text-secondary"
          }`}
        >
          {geral ? "Voltar pro mês selecionado" : "Ver histórico geral"}
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value as typeof filtroTipo)} className="rounded-btn border border-border-neutral bg-card-secondary px-2 py-1.5 text-[12px]">
          <option value="todos">Todos os tipos</option>
          <option value="Receita">Receita</option>
          <option value="Despesa">Despesa</option>
        </select>
        <select value={filtroSituacao} onChange={(e) => setFiltroSituacao(e.target.value as typeof filtroSituacao)} className="rounded-btn border border-border-neutral bg-card-secondary px-2 py-1.5 text-[12px]">
          <option value="todas">Todas as situações</option>
          {(Object.keys(SITUACAO_LABEL) as SituacaoLancamento[]).map((s) => (
            <option key={s} value={s}>
              {SITUACAO_LABEL[s]}
            </option>
          ))}
        </select>
        <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className="rounded-btn border border-border-neutral bg-card-secondary px-2 py-1.5 text-[12px]">
          <option value="todas">Todas as categorias</option>
          {categorias.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={filtroFornecedor} onChange={(e) => setFiltroFornecedor(e.target.value)} className="rounded-btn border border-border-neutral bg-card-secondary px-2 py-1.5 text-[12px]">
          <option value="todos">Todos os fornecedores</option>
          {fornecedores.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
            </option>
          ))}
        </select>
        {formasPagamento.length > 0 && (
          <select value={filtroForma} onChange={(e) => setFiltroForma(e.target.value)} className="rounded-btn border border-border-neutral bg-card-secondary px-2 py-1.5 text-[12px]">
            <option value="todas">Todas as formas</option>
            {formasPagamento.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        )}
        <input
          value={filtroOS}
          onChange={(e) => setFiltroOS(e.target.value)}
          placeholder="Nº da OS..."
          className="w-24 rounded-btn border border-border-neutral bg-card-secondary px-2 py-1.5 text-[12px]"
        />
        {filtrosAtivos && (
          <button type="button" onClick={limparFiltros} className="text-[11.5px] text-text-muted hover:text-text hover:underline">
            Limpar filtros
          </button>
        )}
      </div>

      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por descrição, categoria ou fornecedor..."
        className="mb-3 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
      />

      <div className="mb-3 flex items-center justify-between rounded-btn bg-card-secondary px-3 py-2 text-[12.5px]">
        <span className="text-text-secondary">
          {filtrados.length} registro{filtrados.length === 1 ? "" : "s"} nesse filtro
        </span>
        <span className="font-semibold" style={{ color: somaFiltrados >= 0 ? "#25D366" : "#E07A7A" }}>
          Saldo: {fmtBRL(somaFiltrados)}
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {grupos.map(([data, lancs]) => {
          const periodoDia = { inicio: data, fim: data };
          const realizado = recebido(lancs, periodoDia).total - despesasPagas(lancs, periodoDia).total;

          return (
            <div key={data}>
              <div className="mb-1.5 flex items-center justify-between rounded-btn bg-card-secondary px-3 py-1.5">
                <p className="text-[11.5px] font-semibold capitalize text-text-secondary">{fmtDiaLabel(data)}</p>
                <span className="text-[11px]" style={{ color: realizado >= 0 ? "#25D366" : "#E07A7A" }}>
                  Realizado: {fmtBRL(realizado)}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                {lancs.map((l) => {
                  const situacao = situacaoLancamento(l.status, l.data, hoje);
                  const sv = servicoDoLancamento(l.servico_id);
                  return (
                    <div
                      key={l.id}
                      className="flex flex-col gap-1.5 rounded-btn px-3 py-2 text-[12.5px] hover:bg-card-secondary sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div onClick={() => situacao !== "cancelado" && setEditing(l)} className={situacao !== "cancelado" ? "flex-1 cursor-pointer" : "flex-1"}>
                        <p className="font-medium">
                          {l.descricao} {sv && <span className="text-[10.5px] text-text-muted">· {sv.numero}</span>}
                        </p>
                        <p className="text-[11px] text-text-muted">
                          {fornecedorNome(l.fornecedor_id) ?? l.categoria} · {l.banco || "—"} · {l.forma_pagamento || "—"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span
                          className="rounded-pill px-2 py-0.5 text-[10.5px]"
                          style={{ color: SITUACAO_COR[situacao], border: "1px solid currentColor" }}
                        >
                          {SITUACAO_LABEL[situacao]}
                        </span>
                        <span className={`w-24 text-right font-semibold ${l.tipo === "Despesa" ? "text-danger" : "text-success"}`}>
                          {l.tipo === "Despesa" ? "- " : ""}
                          {fmtBRL(l.valor)}
                        </span>
                        {situacao === "a_vencer" || situacao === "vencido" ? (
                          <button
                            type="button"
                            onClick={() =>
                              startTransition(async () => {
                                const resultado = await marcarLancamentoRealizado(l.id);
                                if (!resultado.ok) {
                                  setError(resultado.message);
                                } else {
                                  router.refresh();
                                }
                              })
                            }
                            className="rounded-btn border border-border-gold-strong px-2 py-1 text-[11px] text-gold"
                          >
                            Marcar realizado
                          </button>
                        ) : null}
                        {situacao !== "cancelado" && (
                          <button type="button" onClick={() => handleCancelar(l)} className="text-[11px] text-danger">
                            Cancelar
                          </button>
                        )}
                        {situacao === "realizado" && (
                          <button type="button" onClick={() => handleEstornar(l)} className="text-[11px] text-danger">
                            Estornar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {grupos.length === 0 && (
          <p className="py-4 text-center text-sm text-text-muted">{lancamentos.length > 0 ? "Nada encontrado nesse filtro." : vazioLabel}</p>
        )}
      </div>

      {editing && (
        <NovoLancamentoModal
          fornecedores={fornecedores}
          editing={editing}
          onClose={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

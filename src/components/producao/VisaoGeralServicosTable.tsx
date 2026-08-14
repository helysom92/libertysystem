"use client";

import { useMemo, useState } from "react";
import { PRAZO_STATUS_COLOR, PRAZO_STATUS_LABEL, prazoStatus, type Coluna, type PrazoStatus } from "@/lib/domain/kanban";
import { displayNumero, type ItemOrcamento, type Servico } from "@/lib/domain/types";
import { normalizarBusca } from "@/lib/domain/texto";
import type { Role } from "@/lib/domain/flows";
import CentralDoServico from "@/components/servico-modal/CentralDoServico";

const PRAZO_FILTROS: { value: "todos" | PrazoStatus; label: string }[] = [
  { value: "todos", label: "Qualquer prazo" },
  { value: "red", label: "Atrasado" },
  { value: "yellow", label: "Atenção" },
  { value: "green", label: "No prazo" },
];

export default function VisaoGeralServicosTable({
  servicos,
  colunas,
  role,
  itensOrcamento,
  initialOpenId,
}: {
  servicos: Servico[];
  colunas: Coluna[];
  role: Role;
  itensOrcamento: ItemOrcamento[];
  initialOpenId?: string | null;
}) {
  const [openId, setOpenId] = useState<string | null>(initialOpenId ?? null);
  const [busca, setBusca] = useState("");
  const [prazoFiltro, setPrazoFiltro] = useState<"todos" | PrazoStatus>("todos");
  const [somenteAtivos, setSomenteAtivos] = useState(true);

  const colunaLabel = useMemo(() => new Map(colunas.map((c) => [c.id, c.label])), [colunas]);

  const linhas = useMemo(() => {
    return servicos
      .filter((s) => s.numero != null)
      .filter((s) => !somenteAtivos || !s.concluido)
      .filter((s) => {
        const status = prazoStatus(s.prazo_tipo, s.prazo);
        return prazoFiltro === "todos" || status === prazoFiltro;
      })
      .filter((s) => {
        const termo = normalizarBusca(busca.trim());
        if (!termo) return true;
        return (
          normalizarBusca(s.cliente).includes(termo) ||
          normalizarBusca(s.descricao).includes(termo) ||
          normalizarBusca(s.numero ?? "").includes(termo)
        );
      })
      .sort((a, b) => {
        const da = a.prazo ? new Date(a.prazo).getTime() : Infinity;
        const db = b.prazo ? new Date(b.prazo).getTime() : Infinity;
        return da - db;
      });
  }, [servicos, somenteAtivos, prazoFiltro, busca]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-xl font-bold">Visão Geral</h1>
        <p className="text-[13px] text-text-secondary">Todas as Ordens de Serviço numa lista só, sem arrastar card</p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por cliente, número ou descrição..."
          className="min-w-[220px] flex-1 rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-[13px]"
        />
        <select
          value={prazoFiltro}
          onChange={(e) => setPrazoFiltro(e.target.value as "todos" | PrazoStatus)}
          className="rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-[13px]"
        >
          {PRAZO_FILTROS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-[13px] text-text-secondary">
          <input type="checkbox" checked={somenteAtivos} onChange={(e) => setSomenteAtivos(e.target.checked)} />
          Só ativas (esconder concluídas)
        </label>
      </div>

      <div className="overflow-x-auto rounded-card border border-border-neutral">
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead className="bg-card-secondary text-[11px] tracking-wide text-text-muted uppercase">
            <tr>
              <th className="px-3 py-2.5">Nº</th>
              <th className="px-3 py-2.5">Cliente</th>
              <th className="px-3 py-2.5">Descrição</th>
              <th className="px-3 py-2.5">Etapa</th>
              <th className="px-3 py-2.5">Prazo</th>
              <th className="px-3 py-2.5">Responsável</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((s) => {
              const status = prazoStatus(s.prazo_tipo, s.prazo);
              return (
                <tr
                  key={s.id}
                  onClick={() => setOpenId(s.id)}
                  className="cursor-pointer border-t border-border-neutral hover:bg-card-secondary"
                >
                  <td className="px-3 py-2.5 font-semibold text-gold">{displayNumero(s)}</td>
                  <td className="px-3 py-2.5">{s.cliente}</td>
                  <td className="max-w-[260px] truncate px-3 py-2.5 text-text-secondary">{s.descricao}</td>
                  <td className="px-3 py-2.5 text-text-secondary">
                    {s.coluna_id ? (colunaLabel.get(s.coluna_id) ?? "—") : "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    {status ? (
                      <span
                        className="rounded-pill px-2 py-0.5 text-[10.5px] font-semibold"
                        style={{ color: PRAZO_STATUS_COLOR[status], backgroundColor: `${PRAZO_STATUS_COLOR[status]}22` }}
                      >
                        ● {PRAZO_STATUS_LABEL[status]}
                      </span>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-text-secondary">{s.responsavel || "—"}</td>
                </tr>
              );
            })}
            {linhas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-text-muted">
                  Nenhuma OS encontrada com esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="border-t border-border-neutral px-3 py-2 text-[12px] text-text-secondary">
          {linhas.length} OS
        </p>
      </div>

      {openId && (
        <CentralDoServico
          servicoId={openId}
          role={role}
          context="producao"
          itensOrcamento={itensOrcamento}
          colunasOS={colunas.filter((c) => c.board === "os").sort((a, b) => a.ordem - b.ordem)}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

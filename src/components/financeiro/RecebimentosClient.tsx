"use client";

import { useMemo, useState } from "react";
import { fmtBRL } from "@/lib/domain/types";
import { fmtDatePtBR } from "@/lib/domain/dates";
import { normalizarBusca } from "@/lib/domain/texto";
import { FINANCEIRO_STATUSES, type FinanceiroStatus, type Role } from "@/lib/domain/flows";
import RecebimentoModal from "./RecebimentoModal";

export interface RecebimentoRow {
  id: string;
  numero: string | null;
  cliente: string;
  valor: number;
  valor_pago: number;
  financeiro_status: FinanceiroStatus;
  prazo: string | null;
  concluido: boolean;
  criado_em: string;
}

// Ordem pensada pro fluxo de recebimento — o que precisa de atenção primeiro fica à esquerda.
const COLUNAS: FinanceiroStatus[] = [
  "Aguardando sinal",
  "Parcialmente pago",
  "Vencido",
  "Orçado",
  "Não orçado",
  "Pago",
  "Cortesia",
  "Cancelado",
];

export default function RecebimentosClient({
  servicos,
  role,
}: {
  servicos: RecebimentoRow[];
  role: Role;
}) {
  const [busca, setBusca] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!busca) return servicos;
    const termo = normalizarBusca(busca);
    return servicos.filter(
      (s) =>
        normalizarBusca(s.cliente).includes(termo) ||
        (s.numero && normalizarBusca(s.numero).includes(termo))
    );
  }, [servicos, busca]);

  const porStatus = useMemo(() => {
    const map = new Map<FinanceiroStatus, RecebimentoRow[]>();
    for (const status of FINANCEIRO_STATUSES) map.set(status, []);
    for (const s of filtered) {
      const lista = map.get(s.financeiro_status);
      if (lista) lista.push(s);
      else map.set(s.financeiro_status, [s]);
    }
    return map;
  }, [filtered]);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold">Recebimentos</h1>
          <p className="text-[13px] text-text-secondary">
            Sinal, restante e parcelas de cada OS — clique num card pra ver/confirmar os pagamentos
          </p>
        </div>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por cliente ou nº..."
          className="w-64 rounded-btn border border-border-neutral bg-card-secondary px-3 py-1.5 text-sm"
        />
      </div>

      <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
        {COLUNAS.map((status) => {
          const items = porStatus.get(status) ?? [];
          return (
            <div
              key={status}
              className="flex w-72 shrink-0 flex-col rounded-card border border-border-neutral bg-card-secondary p-3"
            >
              <div className="mb-3 flex items-center justify-between gap-1.5">
                <span className="flex-1 truncate text-[11px] font-bold tracking-wide text-gold uppercase">
                  {status}
                </span>
                <span className="rounded-pill bg-black/30 px-1.5 py-0.5 text-[11px] text-text-muted">
                  {items.length}
                </span>
              </div>

              <div className="flex flex-col gap-3">
                {items.map((s) => {
                  const saldo = s.valor - s.valor_pago;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setOpenId(s.id)}
                      className="rounded-card border border-border-neutral bg-card p-3 text-left text-[12.5px] hover:border-border-gold-strong"
                    >
                      <p className="text-[10.5px] tracking-wide text-text-muted uppercase">{s.numero}</p>
                      <p className="font-semibold">{s.cliente}</p>
                      <div className="mt-1.5 flex items-center justify-between">
                        <span className="text-text-secondary">
                          {s.prazo ? fmtDatePtBR(s.prazo) : "sem prazo"}
                        </span>
                        <span className="font-semibold text-gradient-gold">{fmtBRL(s.valor)}</span>
                      </div>
                      {saldo > 0 && (
                        <p className="mt-1 text-[11px] text-gold">Saldo: {fmtBRL(saldo)}</p>
                      )}
                    </button>
                  );
                })}
                {items.length === 0 && (
                  <p className="text-[11.5px] text-text-muted">Nenhuma OS aqui.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {openId && (
        <RecebimentoModal servicoId={openId} role={role} onClose={() => setOpenId(null)} />
      )}
    </div>
  );
}

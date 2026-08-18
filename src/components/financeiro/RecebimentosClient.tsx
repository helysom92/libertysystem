"use client";

import { useMemo, useState } from "react";
import { fmtBRL } from "@/lib/domain/types";
import { fmtDatePtBR } from "@/lib/domain/dates";
import { normalizarBusca } from "@/lib/domain/texto";
import type { FinanceiroStatus, Role } from "@/lib/domain/flows";
import FinanceiroBadge from "@/components/ui/FinanceiroBadge";
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
  lancado: boolean;
}

const ABAS = [
  { id: "abertas", label: "Abertas" },
  { id: "fechadas", label: "Fechadas" },
  { id: "todas", label: "Todas" },
] as const;
type Aba = (typeof ABAS)[number]["id"];

export default function RecebimentosClient({
  servicos,
  role,
}: {
  servicos: RecebimentoRow[];
  role: Role;
}) {
  const [aba, setAba] = useState<Aba>("abertas");
  const [busca, setBusca] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return servicos.filter((s) => {
      const saldo = s.valor - s.valor_pago;
      if (aba === "abertas" && saldo <= 0) return false;
      if (aba === "fechadas" && saldo > 0) return false;
      if (busca) {
        const termo = normalizarBusca(busca);
        const bate =
          normalizarBusca(s.cliente).includes(termo) ||
          (s.numero && normalizarBusca(s.numero).includes(termo));
        if (!bate) return false;
      }
      return true;
    });
  }, [servicos, aba, busca]);

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold">Recebimentos</h1>
          <p className="text-[13px] text-text-secondary">
            Sinal, restante e parcelas de cada OS — clique numa linha pra ver/lançar os pagamentos
          </p>
        </div>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por cliente ou nº..."
          className="w-64 rounded-btn border border-border-neutral bg-card-secondary px-3 py-1.5 text-sm"
        />
      </div>

      <div className="mb-4 flex gap-1">
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAba(a.id)}
            className={`rounded-btn px-3 py-1.5 text-[12.5px] ${
              aba === a.id ? "bg-card font-semibold text-gold" : "text-text-secondary hover:bg-card"
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-card border border-border-neutral">
        <table className="w-full text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-border-neutral text-[10.5px] tracking-wide text-text-muted uppercase">
              <th className="px-3 py-2">Nº OS</th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Prazo</th>
              <th className="px-3 py-2">Valor Total</th>
              <th className="px-3 py-2">Pago</th>
              <th className="px-3 py-2">Saldo</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Lançamento</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const saldo = s.valor - s.valor_pago;
              return (
                <tr
                  key={s.id}
                  onClick={() => setOpenId(s.id)}
                  className="cursor-pointer border-b border-border-neutral bg-card hover:bg-card-secondary"
                >
                  <td className="px-3 py-2 font-semibold">{s.numero}</td>
                  <td className="px-3 py-2">{s.cliente}</td>
                  <td className="px-3 py-2 text-text-secondary">{s.prazo ? fmtDatePtBR(s.prazo) : "—"}</td>
                  <td className="px-3 py-2 font-semibold text-gradient-gold">{fmtBRL(s.valor)}</td>
                  <td className="px-3 py-2">{fmtBRL(s.valor_pago)}</td>
                  <td className="px-3 py-2">{fmtBRL(saldo)}</td>
                  <td className="px-3 py-2">
                    <FinanceiroBadge status={s.financeiro_status} />
                  </td>
                  <td className="px-3 py-2">
                    {s.lancado ? (
                      <span className="rounded-pill bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
                        Lançado
                      </span>
                    ) : (
                      <span className="rounded-pill border border-border-gold-strong px-2 py-0.5 text-[11px] text-gold">
                        Não lançado
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-text-muted">
                  Nenhuma OS encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {openId && (
        <RecebimentoModal servicoId={openId} role={role} onClose={() => setOpenId(null)} />
      )}
    </div>
  );
}

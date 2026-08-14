"use client";

import { useMemo, useState } from "react";
import { fmtBRL } from "@/lib/domain/types";
import { fmtDatePtBR } from "@/lib/domain/dates";
import { normalizarBusca } from "@/lib/domain/texto";
import type { Role } from "@/lib/domain/flows";
import FinanceiroBadge from "@/components/ui/FinanceiroBadge";
import RecebimentoModal from "./RecebimentoModal";

export interface RecebimentoRow {
  id: string;
  numero: string | null;
  cliente: string;
  valor: number;
  valor_pago: number;
  financeiro_status: string;
  prazo: string | null;
  concluido: boolean;
  criado_em: string;
}

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

  return (
    <div>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="font-display text-xl font-bold">Recebimentos</h1>
          <p className="text-[13px] text-text-secondary">
            Sinal, restante e parcelas de cada OS — clique numa linha pra ver/confirmar os pagamentos
          </p>
        </div>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por cliente ou nº..."
          className="w-64 rounded-btn border border-border-neutral bg-card-secondary px-3 py-1.5 text-sm"
        />
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
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
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
                <td className="px-3 py-2">{fmtBRL(s.valor - s.valor_pago)}</td>
                <td className="px-3 py-2">
                  <FinanceiroBadge status={s.financeiro_status} />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-text-muted">
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

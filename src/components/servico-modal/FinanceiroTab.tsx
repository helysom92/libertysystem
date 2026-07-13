"use client";

import { useState, useTransition } from "react";
import type { ServicoDetail } from "@/lib/domain/types";
import { fmtBRL } from "@/lib/domain/types";
import { FINANCEIRO_STATUSES, type Role } from "@/lib/domain/flows";
import { updateFinanceiro } from "@/lib/actions/servicos";

export default function FinanceiroTab({
  detail,
  role,
  onChanged,
}: {
  detail: ServicoDetail;
  role: Role;
  onChanged: () => void;
}) {
  const { servico } = detail;
  const [valorPago, setValorPago] = useState(String(servico.valor_pago));
  const [, startTransition] = useTransition();
  const canEdit = role === "administrador" || role === "secretaria";
  const saldo = servico.valor - servico.valor_pago;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-card border border-border-neutral bg-card-secondary p-3">
          <p className="mb-1 text-[10.5px] tracking-wide text-text-muted uppercase">Valor Total</p>
          <p className="font-display text-sm font-bold text-gradient-gold">{fmtBRL(servico.valor)}</p>
        </div>
        <div className="rounded-card border border-border-neutral bg-card-secondary p-3">
          <p className="mb-1 text-[10.5px] tracking-wide text-text-muted uppercase">Pago</p>
          <p className="text-sm font-semibold">{fmtBRL(servico.valor_pago)}</p>
        </div>
        <div className="rounded-card border border-border-neutral bg-card-secondary p-3">
          <p className="mb-1 text-[10.5px] tracking-wide text-text-muted uppercase">Saldo</p>
          <p className="text-sm font-semibold">{fmtBRL(saldo)}</p>
        </div>
      </div>

      {!canEdit && (
        <p className="text-[12.5px] text-text-muted">
          Apenas Administrador ou Secretaria podem alterar o financeiro deste serviço.
        </p>
      )}

      <div>
        <label className="mb-1 block text-[10.5px] tracking-wide text-text-muted uppercase">
          Valor Pago
        </label>
        <input
          type="number"
          value={valorPago}
          disabled={!canEdit}
          onChange={(e) => setValorPago(e.target.value)}
          onBlur={() =>
            startTransition(async () => {
              await updateFinanceiro(servico.id, { valor_pago: Number(valorPago) || 0 });
              onChanged();
            })
          }
          className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm disabled:opacity-50"
        />
      </div>

      <div>
        <label className="mb-1 block text-[10.5px] tracking-wide text-text-muted uppercase">
          Status Financeiro
        </label>
        <select
          defaultValue={servico.financeiro_status}
          disabled={!canEdit}
          onChange={(e) =>
            startTransition(async () => {
              await updateFinanceiro(servico.id, { financeiro_status: e.target.value });
              onChanged();
            })
          }
          className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm disabled:opacity-50"
        >
          {FINANCEIRO_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

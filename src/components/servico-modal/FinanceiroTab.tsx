"use client";

import { useState } from "react";
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
  const [valorDirty, setValorDirty] = useState(false);
  const [valorSaving, setValorSaving] = useState(false);
  const [valorError, setValorError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const canEdit = role === "administrador" || role === "secretaria";
  const saldo = servico.valor - servico.valor_pago;

  async function saveValorPago() {
    setValorSaving(true);
    setValorError(null);
    try {
      await updateFinanceiro(servico.id, { valor_pago: Number(valorPago) || 0 });
      setValorDirty(false);
      onChanged();
    } catch (err) {
      setValorError(err instanceof Error ? err.message : "Erro desconhecido ao salvar.");
    } finally {
      setValorSaving(false);
    }
  }

  async function saveStatus(status: string) {
    setStatusError(null);
    try {
      await updateFinanceiro(servico.id, { financeiro_status: status });
      onChanged();
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Erro desconhecido ao salvar.");
    }
  }

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
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={valorPago}
            disabled={!canEdit}
            onChange={(e) => {
              setValorPago(e.target.value);
              setValorDirty(true);
            }}
            className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm disabled:opacity-50"
          />
          {canEdit && (
            <button
              type="button"
              onClick={saveValorPago}
              disabled={!valorDirty || valorSaving}
              className="shrink-0 rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40"
            >
              {valorSaving ? "Salvando..." : "Salvar"}
            </button>
          )}
        </div>
        {valorError && <p className="mt-1 text-[12px] text-danger">Não foi possível salvar: {valorError}</p>}
      </div>

      <div>
        <label className="mb-1 block text-[10.5px] tracking-wide text-text-muted uppercase">
          Status Financeiro
        </label>
        <select
          defaultValue={servico.financeiro_status}
          disabled={!canEdit}
          onChange={(e) => saveStatus(e.target.value)}
          className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm disabled:opacity-50"
        >
          {FINANCEIRO_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {statusError && <p className="mt-1 text-[12px] text-danger">Não foi possível salvar: {statusError}</p>}
      </div>
    </div>
  );
}

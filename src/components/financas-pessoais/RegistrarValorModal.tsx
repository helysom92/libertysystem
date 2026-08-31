"use client";

import { useState, useTransition } from "react";
import type { ContaPessoal } from "@/lib/domain/types";
import { hojeISOOperacao } from "@/lib/domain/dates";
import { fmtBRL } from "@/lib/domain/types";

export default function RegistrarValorModal({
  titulo,
  saldoAberto,
  contas,
  contaLabel,
  onConfirm,
  onClose,
}: {
  titulo: string;
  saldoAberto: number;
  contas: ContaPessoal[];
  contaLabel: string;
  onConfirm: (valor: number, data: string, contaId: string | null) => Promise<void>;
  onClose: () => void;
}) {
  const [valor, setValor] = useState(String(saldoAberto));
  const [data, setData] = useState(hojeISOOperacao());
  const [contaId, setContaId] = useState<string>(contas[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const valorNum = Number(valor.replace(",", "."));
    if (!valorNum || valorNum <= 0) {
      setError("Informe um valor maior que zero.");
      return;
    }
    startTransition(async () => {
      try {
        await onConfirm(valorNum, data, contaId || null);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível registrar.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-card border border-border-gold bg-card p-6"
      >
        <h2 className="mb-1 font-display text-lg font-bold">{titulo}</h2>
        <p className="mb-4 text-[12px] text-text-secondary">Saldo em aberto: {fmtBRL(saldoAberto)}</p>

        <label className="mb-1 block text-xs text-text-secondary">Valor</label>
        <input
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          inputMode="decimal"
          className="mb-3 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
        />

        <label className="mb-1 block text-xs text-text-secondary">Data</label>
        <input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="mb-3 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
        />

        {contas.length > 0 && (
          <>
            <label className="mb-1 block text-xs text-text-secondary">{contaLabel}</label>
            <select
              value={contaId}
              onChange={(e) => setContaId(e.target.value)}
              className="mb-3 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            >
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </>
        )}

        {error && <p className="mb-3 text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-btn px-4 py-2 text-sm text-text-secondary hover:text-text">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-4 py-2 text-sm font-semibold text-bg disabled:opacity-60"
          >
            {pending ? "Salvando..." : "Confirmar"}
          </button>
        </div>
      </form>
    </div>
  );
}

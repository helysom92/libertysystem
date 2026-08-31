"use client";

import { useState, useTransition } from "react";
import type { ContaPessoal } from "@/lib/domain/types";
import { hojeISOOperacao } from "@/lib/domain/dates";
import { createTransferencia } from "@/lib/actions/financasPessoais";

export default function NovaTransferenciaModal({ contas, onClose }: { contas: ContaPessoal[]; onClose: () => void }) {
  const [origemId, setOrigemId] = useState(contas[0]?.id ?? "");
  const [destinoId, setDestinoId] = useState(contas[1]?.id ?? contas[0]?.id ?? "");
  const [valor, setValor] = useState("");
  const [tarifa, setTarifa] = useState("0");
  const [data, setData] = useState(hojeISOOperacao());
  const [descricao, setDescricao] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (origemId === destinoId) {
      setError("A conta de origem e destino não podem ser a mesma.");
      return;
    }
    const valorNum = Number(valor.replace(",", "."));
    const tarifaNum = Number(tarifa.replace(",", ".")) || 0;
    if (!valorNum || valorNum <= 0) {
      setError("Informe um valor maior que zero.");
      return;
    }
    startTransition(async () => {
      try {
        await createTransferencia({
          conta_origem_id: origemId,
          conta_destino_id: destinoId,
          valor: valorNum,
          tarifa: tarifaNum,
          data,
          descricao: descricao || null,
        });
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível registrar essa transferência.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-card border border-border-gold bg-card p-6"
      >
        <h2 className="mb-4 font-display text-lg font-bold">Transferência entre contas</h2>
        <p className="mb-4 text-[12px] text-text-secondary">
          Não conta como receita nem despesa — só move dinheiro entre suas próprias contas.
        </p>

        <div className="mb-3 flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">De</label>
            <select
              value={origemId}
              onChange={(e) => setOrigemId(e.target.value)}
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            >
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Para</label>
            <select
              value={destinoId}
              onChange={(e) => setDestinoId(e.target.value)}
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            >
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-3 flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Valor</label>
            <input
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              inputMode="decimal"
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Tarifa (se houver)</label>
            <input
              value={tarifa}
              onChange={(e) => setTarifa(e.target.value)}
              inputMode="decimal"
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            />
          </div>
        </div>

        <label className="mb-1 block text-xs text-text-secondary">Data</label>
        <input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="mb-3 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
        />

        <label className="mb-1 block text-xs text-text-secondary">Descrição (opcional)</label>
        <input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className="mb-4 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
        />

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
            {pending ? "Salvando..." : "Transferir"}
          </button>
        </div>
      </form>
    </div>
  );
}

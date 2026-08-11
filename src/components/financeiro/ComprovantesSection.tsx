"use client";

import { useState, useTransition } from "react";
import type { Comprovante } from "@/lib/domain/types";
import { fmtBRL } from "@/lib/domain/types";
import { confirmarComprovante, deleteComprovante, registrarComprovante } from "@/lib/actions/financeiro";

export default function ComprovantesSection({ comprovantes }: { comprovantes: Comprovante[] }) {
  const [open, setOpen] = useState(false);
  const [banco, setBanco] = useState("");
  const [valor, setValor] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const pendentes = comprovantes.filter((c) => c.status === "pendente");

  function submitNovo(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await registrarComprovante({
          descricao: "Comprovante recebido",
          banco,
          valor: Number(valor) || 0,
        });
        setBanco("");
        setValor("");
        setOpen(false);
      } catch (err) {
        console.error("Falha ao registrar comprovante", err);
        setError(err instanceof Error ? err.message : "Não foi possível registrar esse comprovante.");
      }
    });
  }

  function handleConfirmar(id: string) {
    setError(null);
    startTransition(async () => {
      try {
        await confirmarComprovante(id);
      } catch (err) {
        console.error("Falha ao confirmar comprovante", err);
        setError(err instanceof Error ? err.message : "Não foi possível confirmar esse comprovante.");
      }
    });
  }

  function handleExcluir(id: string) {
    if (!confirm("Excluir esse comprovante? Essa ação não pode ser desfeita.")) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await deleteComprovante(id);
        if (!result.ok) {
          setError(result.reason ?? "Não foi possível excluir esse comprovante.");
        }
      } catch (err) {
        console.error("Falha ao excluir comprovante", err);
        setError(err instanceof Error ? err.message : "Não foi possível excluir esse comprovante.");
      }
    });
  }

  return (
    <div className="rounded-card border border-border-neutral bg-card p-4">
      {error && (
        <p className="mb-3 rounded-btn border border-danger-border bg-card-secondary px-3 py-2 text-[12.5px] text-danger">
          {error}
        </p>
      )}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="font-display text-sm font-bold">Comprovantes</h3>
          <p className="text-[12px] text-text-secondary">
            Secretaria registra · Administrador confirma
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-3 py-1.5 text-[12.5px] font-semibold text-bg"
        >
          + Registrar Comprovante
        </button>
      </div>

      {open && (
        <form onSubmit={submitNovo} className="mb-3 flex gap-2 rounded-btn bg-card-secondary p-2">
          <input
            placeholder="Banco"
            value={banco}
            onChange={(e) => setBanco(e.target.value)}
            className="flex-1 rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
          />
          <input
            type="number"
            placeholder="Valor"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="w-28 rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-btn bg-gold px-3 py-1.5 text-sm font-semibold text-bg"
          >
            Salvar
          </button>
        </form>
      )}

      {pendentes.length === 0 ? (
        <p className="py-4 text-center text-sm text-text-muted">Nenhum comprovante pendente.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {pendentes.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-btn bg-card-secondary px-3 py-2 text-sm"
            >
              <span>
                {c.banco} · {fmtBRL(c.valor)}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleConfirmar(c.id)}
                  className="rounded-btn border border-border-gold-strong px-3 py-1 text-[12px] text-gold"
                >
                  Confirmar Lançamento
                </button>
                <button
                  type="button"
                  onClick={() => handleExcluir(c.id)}
                  className="rounded-btn border border-danger-border px-3 py-1 text-[12px] text-danger"
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

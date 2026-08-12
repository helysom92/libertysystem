"use client";

import { useState, useTransition } from "react";
import { createDespesaFixa, deleteDespesaFixa, updateDespesaFixa } from "@/lib/actions/financeiro";
import type { DespesaFixa, Fornecedor } from "@/lib/domain/types";

export default function NovaDespesaFixaModal({
  fornecedores,
  editing,
  onClose,
}: {
  fornecedores: Fornecedor[];
  editing?: DespesaFixa;
  onClose: () => void;
}) {
  const [descricao, setDescricao] = useState(editing?.descricao ?? "");
  const [valor, setValor] = useState(editing ? String(editing.valor) : "");
  const [diaVencimento, setDiaVencimento] = useState(editing ? String(editing.dia_vencimento) : "10");
  const [categoria, setCategoria] = useState(editing?.categoria ?? "Geral");
  const [fornecedorId, setFornecedorId] = useState(editing?.fornecedor_id ?? "");
  const [pending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const payload = {
          descricao,
          valor: Number(valor) || 0,
          dia_vencimento: Number(diaVencimento) || 1,
          categoria,
          fornecedor_id: fornecedorId || null,
        };
        if (editing) {
          await updateDespesaFixa(editing.id, payload);
        } else {
          await createDespesaFixa(payload);
        }
        onClose();
      } catch (err) {
        console.error("Falha ao salvar despesa fixa", err);
        setError(err instanceof Error ? err.message : "Não foi possível salvar essa despesa fixa.");
      }
    });
  }

  function handleDelete() {
    if (!editing) return;
    if (!confirm("Excluir essa despesa fixa? Essa ação não pode ser desfeita.")) return;
    setDeleting(true);
    setError(null);
    deleteDespesaFixa(editing.id)
      .then(onClose)
      .catch((err) => {
        console.error("Falha ao excluir despesa fixa", err);
        setError(err instanceof Error ? err.message : "Não foi possível excluir essa despesa fixa.");
        setDeleting(false);
      });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-card border border-border-gold bg-card p-6"
      >
        <h2 className="mb-4 font-display text-lg font-bold">
          {editing ? "Editar Despesa Fixa" : "Nova Despesa Fixa"}
        </h2>

        <label className="mb-1 block text-xs text-text-secondary">Descrição</label>
        <input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className="mb-3 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
        />

        <div className="mb-4 flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Valor</label>
            <input
              type="number"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Dia Vencimento</label>
            <input
              type="number"
              min={1}
              max={31}
              value={diaVencimento}
              onChange={(e) => setDiaVencimento(e.target.value)}
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Categoria</label>
            <input
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            />
          </div>
        </div>

        <label className="mb-1 block text-xs text-text-secondary">Fornecedor</label>
        <select
          value={fornecedorId}
          onChange={(e) => setFornecedorId(e.target.value)}
          className="mb-4 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
        >
          <option value="">—</option>
          {fornecedores.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
            </option>
          ))}
        </select>

        {error && <p className="mb-3 text-sm text-danger">{error}</p>}

        <div className="flex items-center justify-between gap-2">
          {editing ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-btn border border-danger-border px-4 py-2 text-sm text-danger disabled:opacity-60"
            >
              {deleting ? "Excluindo..." : "Excluir"}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-btn px-4 py-2 text-sm text-text-secondary hover:text-text"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-4 py-2 text-sm font-semibold text-bg disabled:opacity-60"
            >
              {pending ? "Salvando..." : editing ? "Salvar" : "Adicionar"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

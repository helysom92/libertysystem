"use client";

import { useState, useTransition } from "react";
import { createDespesaVariavel } from "@/lib/actions/financeiro";
import type { Fornecedor } from "@/lib/domain/types";

export default function NovaDespesaVariavelModal({
  fornecedores,
  onClose,
}: {
  fornecedores: Fornecedor[];
  onClose: () => void;
}) {
  const [descricao, setDescricao] = useState("");
  const [valorProvisionado, setValorProvisionado] = useState("");
  const [categoria, setCategoria] = useState("Geral");
  const [fornecedorId, setFornecedorId] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createDespesaVariavel({
          descricao,
          valor_provisionado: Number(valorProvisionado) || 0,
          categoria,
          fornecedor_id: fornecedorId || null,
        });
        onClose();
      } catch (err) {
        console.error("Falha ao criar despesa variável", err);
        setError(err instanceof Error ? err.message : "Não foi possível salvar essa despesa variável.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-card border border-border-gold bg-card p-6"
      >
        <h2 className="mb-4 font-display text-lg font-bold">Nova Despesa Variável</h2>

        <label className="mb-1 block text-xs text-text-secondary">Descrição</label>
        <input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Água, Energia, Comissão..."
          className="mb-3 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
        />

        <div className="mb-4 flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Valor Provisionado</label>
            <input
              type="number"
              step="0.01"
              value={valorProvisionado}
              onChange={(e) => setValorProvisionado(e.target.value)}
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

        <div className="flex justify-end gap-2">
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
            {pending ? "Salvando..." : "Adicionar"}
          </button>
        </div>
      </form>
    </div>
  );
}

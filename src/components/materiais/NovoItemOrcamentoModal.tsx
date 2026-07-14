"use client";

import { useState, useTransition } from "react";
import { createItemOrcamento } from "@/lib/actions/itensOrcamento";

export default function NovoItemOrcamentoModal({ onClose }: { onClose: () => void }) {
  const [nome, setNome] = useState("");
  const [tipoCobranca, setTipoCobranca] = useState<"m2" | "fixo">("m2");
  const [preco, setPreco] = useState("");
  const [semPreco, setSemPreco] = useState(false);
  const [categoria, setCategoria] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome) {
      setError("Nome é obrigatório.");
      return;
    }
    startTransition(async () => {
      try {
        await createItemOrcamento({
          nome,
          tipo_cobranca: tipoCobranca,
          preco: semPreco ? null : Number(preco) || 0,
          categoria: categoria || null,
        });
        onClose();
      } catch {
        setError("Não foi possível criar o item.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-card border border-border-gold bg-card p-6"
      >
        <h2 className="mb-4 font-display text-lg font-bold">Novo Item de Orçamento</h2>

        <label className="mb-1 block text-xs text-text-secondary">Nome</label>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Banner padrão, Adesivo comum..."
          className="mb-3 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
        />

        <div className="mb-3 flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Cobrança</label>
            <select
              value={tipoCobranca}
              onChange={(e) => setTipoCobranca(e.target.value as "m2" | "fixo")}
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            >
              <option value="m2">Por m²</option>
              <option value="fixo">Fixo</option>
            </select>
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

        <label className="mb-1 flex items-center gap-2 text-xs text-text-secondary">
          <input
            type="checkbox"
            checked={semPreco}
            onChange={(e) => setSemPreco(e.target.checked)}
          />
          Sob projeto (sem preço fixo)
        </label>

        {!semPreco && (
          <>
            <label className="mb-1 mt-2 block text-xs text-text-secondary">
              Preço {tipoCobranca === "m2" ? "por m²" : "fixo"} (R$)
            </label>
            <input
              type="number"
              step="0.01"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
              className="mb-3 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            />
          </>
        )}

        {error && <p className="mb-3 mt-2 text-sm text-danger">{error}</p>}

        <div className="mt-3 flex justify-end gap-2">
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
            {pending ? "Criando..." : "Criar Item"}
          </button>
        </div>
      </form>
    </div>
  );
}

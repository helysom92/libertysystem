"use client";

import { useState, useTransition } from "react";
import { createMaterial } from "@/lib/actions/materiais";

const UNIDADES = [
  { value: "m2", label: "m² (área)" },
  { value: "metro_linear", label: "metro linear" },
  { value: "unidade", label: "unidade" },
] as const;

export default function NovoMaterialModal({ onClose }: { onClose: () => void }) {
  const [nome, setNome] = useState("");
  const [unidade, setUnidade] = useState<"m2" | "metro_linear" | "unidade">("m2");
  const [preco, setPreco] = useState("");
  const [categoria, setCategoria] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome || !preco) {
      setError("Nome e preço são obrigatórios.");
      return;
    }
    startTransition(async () => {
      try {
        await createMaterial({
          nome,
          unidade,
          preco_unitario: Number(preco) || 0,
          categoria: categoria || null,
        });
        onClose();
      } catch {
        setError("Não foi possível criar o material.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-card border border-border-gold bg-card p-6"
      >
        <h2 className="mb-4 font-display text-lg font-bold">Novo Material</h2>

        <label className="mb-1 block text-xs text-text-secondary">Nome</label>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="ACM Branco, Lona 440g, Vinil Adesivo..."
          className="mb-3 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
        />

        <div className="mb-3 flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Unidade</label>
            <select
              value={unidade}
              onChange={(e) => setUnidade(e.target.value as typeof unidade)}
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            >
              {UNIDADES.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Preço Unitário (R$)</label>
            <input
              type="number"
              step="0.01"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            />
          </div>
        </div>

        <label className="mb-1 block text-xs text-text-secondary">Categoria</label>
        <input
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          className="mb-4 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
        />

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
            {pending ? "Criando..." : "Criar Material"}
          </button>
        </div>
      </form>
    </div>
  );
}

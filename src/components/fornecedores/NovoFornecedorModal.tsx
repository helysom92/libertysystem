"use client";

import { useState, useTransition } from "react";
import { createFornecedor } from "@/lib/actions/fornecedores";

const CATEGORIAS = ["Matéria Prima", "Terceirizados", "Administrativo", "Financeiro", "Outro"];

export default function NovoFornecedorModal({ onClose }: { onClose: () => void }) {
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState(CATEGORIAS[0]);
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
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
        await createFornecedor({ nome, categoria, telefone: telefone || null, email: email || null });
        onClose();
      } catch {
        setError("Não foi possível criar o fornecedor.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-card border border-border-gold bg-card p-6"
      >
        <h2 className="mb-4 font-display text-lg font-bold">Novo Fornecedor</h2>

        <label className="mb-1 block text-xs text-text-secondary">Nome</label>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="mb-3 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
        />

        <label className="mb-1 block text-xs text-text-secondary">Categoria</label>
        <select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          className="mb-3 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
        >
          {CATEGORIAS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <div className="mb-4 flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Telefone</label>
            <input
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">E-mail</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            />
          </div>
        </div>

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
            {pending ? "Criando..." : "Criar Fornecedor"}
          </button>
        </div>
      </form>
    </div>
  );
}

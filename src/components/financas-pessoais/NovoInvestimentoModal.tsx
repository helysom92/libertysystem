"use client";

import { useState, useTransition } from "react";
import type { InvestimentoPessoal } from "@/lib/domain/types";
import { createInvestimento, updateInvestimento, type InvestimentoInput } from "@/lib/actions/financasPessoais";

export default function NovoInvestimentoModal({
  investimento,
  onClose,
}: {
  investimento?: InvestimentoPessoal;
  onClose: () => void;
}) {
  const [nome, setNome] = useState(investimento?.nome ?? "");
  const [tipo, setTipo] = useState(investimento?.tipo ?? "");
  const [instituicao, setInstituicao] = useState(investimento?.instituicao ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      setError("Nome é obrigatório.");
      return;
    }
    const input: InvestimentoInput = {
      nome: nome.trim(),
      tipo: tipo.trim() || null,
      instituicao: instituicao.trim() || null,
    };
    startTransition(async () => {
      const resultado = investimento ? await updateInvestimento(investimento.id, input) : await createInvestimento(input);
      if (!resultado.ok) {
        setError(resultado.message);
        return;
      }
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-card border border-border-gold bg-card p-6"
      >
        <h2 className="mb-4 font-display text-lg font-bold">{investimento ? "Editar Investimento" : "Novo Investimento"}</h2>

        <label className="mb-1 block text-xs text-text-secondary">Nome</label>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Tesouro Selic, Ações XPML11, Poupança..."
          className="mb-3 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
        />

        <div className="mb-3 flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Tipo</label>
            <input
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              placeholder="Renda fixa, ações, fundo, cripto..."
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Instituição</label>
            <input
              value={instituicao}
              onChange={(e) => setInstituicao(e.target.value)}
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            />
          </div>
        </div>

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
            {pending ? "Salvando..." : investimento ? "Salvar" : "Criar Investimento"}
          </button>
        </div>
      </form>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import type { CartaoPessoal } from "@/lib/domain/types";
import { createCartao, updateCartao, type CartaoInput } from "@/lib/actions/financasPessoais";

export default function NovoCartaoModal({ cartao, onClose }: { cartao?: CartaoPessoal; onClose: () => void }) {
  const [nome, setNome] = useState(cartao?.nome ?? "");
  const [banco, setBanco] = useState(cartao?.banco ?? "");
  const [diaFechamento, setDiaFechamento] = useState(String(cartao?.dia_fechamento ?? ""));
  const [diaVencimento, setDiaVencimento] = useState(String(cartao?.dia_vencimento ?? ""));
  const [limite, setLimite] = useState(cartao?.limite != null ? String(cartao.limite) : "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      setError("Nome é obrigatório.");
      return;
    }
    const fechamento = Number(diaFechamento);
    const vencimento = Number(diaVencimento);
    if (!fechamento || fechamento < 1 || fechamento > 28) {
      setError("Dia de fechamento precisa ser entre 1 e 28.");
      return;
    }
    if (!vencimento || vencimento < 1 || vencimento > 28) {
      setError("Dia de vencimento precisa ser entre 1 e 28.");
      return;
    }
    const input: CartaoInput = {
      nome: nome.trim(),
      banco: banco.trim() || null,
      dia_fechamento: fechamento,
      dia_vencimento: vencimento,
      limite: limite.trim() ? Number(limite.replace(",", ".")) : null,
    };
    startTransition(async () => {
      const resultado = cartao ? await updateCartao(cartao.id, input) : await createCartao(input);
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
        <h2 className="mb-4 font-display text-lg font-bold">{cartao ? "Editar Cartão" : "Novo Cartão"}</h2>

        <label className="mb-1 block text-xs text-text-secondary">Nome</label>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nubank, Itaú..."
          className="mb-3 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
        />

        <label className="mb-1 block text-xs text-text-secondary">Banco/Bandeira (opcional)</label>
        <input
          value={banco}
          onChange={(e) => setBanco(e.target.value)}
          className="mb-3 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
        />

        <div className="mb-3 flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Dia de fechamento</label>
            <input
              value={diaFechamento}
              onChange={(e) => setDiaFechamento(e.target.value)}
              inputMode="numeric"
              placeholder="1-28"
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Dia de vencimento</label>
            <input
              value={diaVencimento}
              onChange={(e) => setDiaVencimento(e.target.value)}
              inputMode="numeric"
              placeholder="1-28"
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            />
          </div>
        </div>

        <label className="mb-1 block text-xs text-text-secondary">Limite (opcional)</label>
        <input
          value={limite}
          onChange={(e) => setLimite(e.target.value)}
          inputMode="decimal"
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
            {pending ? "Salvando..." : cartao ? "Salvar" : "Criar Cartão"}
          </button>
        </div>
      </form>
    </div>
  );
}

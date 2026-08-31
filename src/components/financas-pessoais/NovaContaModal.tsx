"use client";

import { useState, useTransition } from "react";
import type { ContaPessoal } from "@/lib/domain/types";
import { hojeISOOperacao } from "@/lib/domain/dates";
import { createConta, updateConta } from "@/lib/actions/financasPessoais";

export default function NovaContaModal({ conta, onClose }: { conta?: ContaPessoal; onClose: () => void }) {
  const [nome, setNome] = useState(conta?.nome ?? "");
  const [instituicao, setInstituicao] = useState(conta?.instituicao ?? "");
  const [tipo, setTipo] = useState(conta?.tipo ?? "");
  const [saldoInicial, setSaldoInicial] = useState(String(conta?.saldo_inicial ?? 0));
  const [dataSaldoInicial, setDataSaldoInicial] = useState(conta?.data_saldo_inicial ?? hojeISOOperacao());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      setError("Nome é obrigatório.");
      return;
    }
    const valor = Number(saldoInicial.replace(",", "."));
    if (Number.isNaN(valor)) {
      setError("Saldo inicial inválido.");
      return;
    }
    const input = {
      nome: nome.trim(),
      instituicao: instituicao.trim() || null,
      tipo: tipo.trim() || null,
      saldo_inicial: valor,
      data_saldo_inicial: dataSaldoInicial,
    };
    startTransition(async () => {
      try {
        if (conta) await updateConta(conta.id, input);
        else await createConta(input);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível salvar essa conta.");
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
        <h2 className="mb-4 font-display text-lg font-bold">{conta ? "Editar Conta" : "Nova Conta"}</h2>

        <label className="mb-1 block text-xs text-text-secondary">Nome</label>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="mb-3 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
        />

        <div className="mb-3 flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Instituição</label>
            <input
              value={instituicao}
              onChange={(e) => setInstituicao(e.target.value)}
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Tipo</label>
            <input
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              placeholder="Corrente, poupança, carteira..."
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="mb-4 flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Saldo inicial</label>
            <input
              value={saldoInicial}
              onChange={(e) => setSaldoInicial(e.target.value)}
              inputMode="decimal"
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Data do saldo inicial</label>
            <input
              type="date"
              value={dataSaldoInicial}
              onChange={(e) => setDataSaldoInicial(e.target.value)}
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
            {pending ? "Salvando..." : conta ? "Salvar" : "Criar Conta"}
          </button>
        </div>
      </form>
    </div>
  );
}

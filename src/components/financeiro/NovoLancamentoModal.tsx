"use client";

import { useState, useTransition } from "react";
import { createLancamento, deleteLancamento, updateLancamento } from "@/lib/actions/financeiro";
import { todayISO } from "@/lib/domain/dates";
import type { Fornecedor, Lancamento } from "@/lib/domain/types";

const FORMAS_PAGAMENTO = ["Pix", "Dinheiro", "Cartão de Débito", "Cartão de Crédito", "Boleto", "Transferência"];

export default function NovoLancamentoModal({
  fornecedores,
  editing,
  onClose,
}: {
  fornecedores: Fornecedor[];
  editing?: Lancamento;
  onClose: () => void;
}) {
  const [tipo, setTipo] = useState<"Receita" | "Despesa">(editing?.tipo ?? "Receita");
  const [descricao, setDescricao] = useState(editing?.descricao ?? "");
  const [categoria, setCategoria] = useState(editing?.categoria ?? "Geral");
  const [fornecedorId, setFornecedorId] = useState(editing?.fornecedor_id ?? "");
  const [valor, setValor] = useState(editing ? String(editing.valor) : "");
  const [data, setData] = useState(editing?.data ?? todayISO());
  const [banco, setBanco] = useState(editing?.banco ?? "");
  const [formaPagamento, setFormaPagamento] = useState(editing?.forma_pagamento ?? FORMAS_PAGAMENTO[0]);
  const [status, setStatus] = useState<"previsto" | "realizado">(
    editing?.status === "previsto" ? "previsto" : "realizado"
  );
  const [pending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const payload = {
          tipo,
          descricao,
          categoria,
          valor: Number(valor) || 0,
          data,
          fornecedor_id: fornecedorId || null,
          banco: banco || null,
          forma_pagamento: formaPagamento,
          status,
        };
        if (editing) {
          await updateLancamento(editing.id, payload);
        } else {
          await createLancamento(payload);
        }
        onClose();
      } catch (err) {
        console.error("Falha ao salvar lançamento", err);
        setError(err instanceof Error ? err.message : "Não foi possível salvar esse lançamento.");
      }
    });
  }

  function handleDelete() {
    if (!editing) return;
    if (!confirm("Excluir esse lançamento? Essa ação não pode ser desfeita.")) return;
    setDeleting(true);
    setError(null);
    deleteLancamento(editing.id)
      .then(onClose)
      .catch((err) => {
        console.error("Falha ao excluir lançamento", err);
        setError(err instanceof Error ? err.message : "Não foi possível excluir esse lançamento.");
        setDeleting(false);
      });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-card border border-border-gold bg-card p-6"
      >
        <h2 className="mb-4 font-display text-lg font-bold">
          {editing ? "Editar Lançamento" : "Novo Lançamento"}
        </h2>

        <div className="mb-3 flex gap-2">
          {(["Receita", "Despesa"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className={`flex-1 rounded-btn border py-2 text-sm ${
                tipo === t
                  ? "border-gold bg-gold/10 text-gold"
                  : "border-border-neutral text-text-secondary"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <label className="mb-1 block text-xs text-text-secondary">Descrição</label>
        <input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className="mb-3 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
        />

        <div className="mb-3 flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Categoria</label>
            <input
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Fornecedor</label>
            <select
              value={fornecedorId}
              onChange={(e) => setFornecedorId(e.target.value)}
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {fornecedores.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-3 flex gap-3">
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
            <label className="mb-1 block text-xs text-text-secondary">Data</label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="mb-3 flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Banco</label>
            <input
              value={banco}
              onChange={(e) => setBanco(e.target.value)}
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Forma de Pagamento</label>
            <select
              value={formaPagamento}
              onChange={(e) => setFormaPagamento(e.target.value)}
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            >
              {FORMAS_PAGAMENTO.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs text-text-secondary">Status</label>
          <div className="flex gap-2">
            {(["previsto", "realizado"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`flex-1 rounded-btn border py-1.5 text-[12.5px] capitalize ${
                  status === s
                    ? "border-gold bg-gold/10 text-gold"
                    : "border-border-neutral text-text-secondary"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

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

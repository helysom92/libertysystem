"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Fornecedor, LancamentoAtalho } from "@/lib/domain/types";
import {
  createLancamentoAtalho,
  deleteLancamentoAtalho,
  updateLancamentoAtalho,
  type LancamentoAtalhoInput,
} from "@/lib/actions/lancamentoAtalhos";

const FORMAS_PAGAMENTO = ["Pix", "Dinheiro", "Cartão de Débito", "Cartão de Crédito", "Boleto", "Transferência"];

function emptyForm(): LancamentoAtalhoInput {
  return { descricao: "", categoria: "Geral", fornecedor_id: null, forma_pagamento: null };
}

export default function GerenciarAtalhosModal({
  atalhos,
  fornecedores,
  onClose,
}: {
  atalhos: LancamentoAtalho[];
  fornecedores: Fornecedor[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<LancamentoAtalhoInput>(emptyForm());
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit(a: LancamentoAtalho) {
    setEditingId(a.id);
    setForm({
      descricao: a.descricao,
      categoria: a.categoria,
      fornecedor_id: a.fornecedor_id,
      forma_pagamento: a.forma_pagamento,
    });
    setAdding(false);
    setError(null);
  }

  function startAdd() {
    setAdding(true);
    setEditingId(null);
    setForm(emptyForm());
    setError(null);
  }

  function cancelForm() {
    setAdding(false);
    setEditingId(null);
  }

  async function salvar() {
    if (!form.descricao.trim()) {
      setError("Dê um nome pro atalho (ex: Combustível).");
      return;
    }
    setSaving(true);
    setError(null);
    const resultado = editingId ? await updateLancamentoAtalho(editingId, form) : await createLancamentoAtalho(form);
    if (!resultado.ok) {
      setError(resultado.message);
      setSaving(false);
      return;
    }
    cancelForm();
    router.refresh();
    setSaving(false);
  }

  async function excluir(id: string) {
    if (!confirm("Excluir esse atalho? Os lançamentos já feitos com ele não são afetados.")) return;
    const resultado = await deleteLancamentoAtalho(id);
    if (!resultado.ok) {
      alert(resultado.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div
        className="w-full max-w-md rounded-card border border-border-gold bg-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Atalhos de Lançamento</h2>
          <button type="button" onClick={onClose} className="text-text-secondary hover:text-text">
            ✕
          </button>
        </div>
        <p className="mb-3 text-[12.5px] text-text-muted">
          Pra despesas recorrentes com valor/data variáveis (Combustível, Terceirização...) — cada
          atalho vira um botão de lançamento rápido em Lançamentos.
        </p>

        <div className="mb-4 flex flex-col gap-2">
          {atalhos.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-[12.5px]"
            >
              <div>
                <p className="font-medium">{a.descricao}</p>
                <p className="text-[11px] text-text-muted">
                  {a.categoria}
                  {a.forma_pagamento && ` · ${a.forma_pagamento}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => startEdit(a)} className="text-[11.5px] text-gold">
                  Editar
                </button>
                <button type="button" onClick={() => excluir(a.id)} className="text-[11.5px] text-danger">
                  Excluir
                </button>
              </div>
            </div>
          ))}
          {atalhos.length === 0 && !adding && (
            <p className="text-[12.5px] text-text-muted">Nenhum atalho cadastrado ainda.</p>
          )}
        </div>

        {adding || editingId ? (
          <div className="rounded-card border border-border-gold-strong bg-card-secondary p-3">
            <label className="mb-1 block text-[11px] text-text-secondary">Nome do atalho</label>
            <input
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              placeholder="Ex: Combustível"
              className="mb-2 w-full rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
            />
            <div className="mb-2 flex gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-[11px] text-text-secondary">Categoria</label>
                <input
                  value={form.categoria}
                  onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
                  className="w-full rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-[11px] text-text-secondary">Fornecedor</label>
                <select
                  value={form.fornecedor_id ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, fornecedor_id: e.target.value || null }))}
                  className="w-full rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
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
            <label className="mb-1 block text-[11px] text-text-secondary">Forma de pagamento padrão</label>
            <select
              value={form.forma_pagamento ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, forma_pagamento: e.target.value || null }))}
              className="mb-3 w-full rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
            >
              <option value="">—</option>
              {FORMAS_PAGAMENTO.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={salvar}
                disabled={saving}
                className="rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-3 py-1.5 text-[12.5px] font-semibold text-bg disabled:opacity-60"
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
              <button
                type="button"
                onClick={cancelForm}
                className="rounded-btn px-3 py-1.5 text-[12.5px] text-text-secondary"
              >
                Cancelar
              </button>
              {error && <p className="text-[12px] text-danger">{error}</p>}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={startAdd}
            className="w-fit rounded-btn border border-border-gold-strong px-3 py-1.5 text-[12.5px] text-gold"
          >
            + Novo atalho
          </button>
        )}
      </div>
    </div>
  );
}

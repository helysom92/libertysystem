"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Fornecedor } from "@/lib/domain/types";
import { todayISO } from "@/lib/domain/dates";
import { lancarNovaDespesa } from "@/lib/actions/financeiro";

export default function NovaDespesaModal({
  fornecedores,
  onClose,
}: {
  fornecedores: Fornecedor[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [tipo, setTipo] = useState<"fixa" | "variavel">("fixa");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("Geral");
  const [fornecedorId, setFornecedorId] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!descricao.trim()) {
      setError("Dê um nome pra despesa.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await lancarNovaDespesa({
        tipo,
        descricao,
        categoria,
        fornecedor_id: fornecedorId || null,
        valor: Number(valor) || 0,
        data,
      });
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível lançar essa despesa.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-card border border-border-gold bg-card p-6"
      >
        <h2 className="mb-4 font-display text-lg font-bold">Nova Despesa</h2>

        <div className="mb-3 flex gap-2">
          {(["fixa", "variavel"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className={`flex-1 rounded-btn border py-2 text-sm capitalize ${
                tipo === t ? "border-gold bg-gold/10 text-gold" : "border-border-neutral text-text-secondary"
              }`}
            >
              {t === "fixa" ? "Fixa (repete todo mês)" : "Variável (valor muda)"}
            </button>
          ))}
        </div>

        <label className="mb-1 block text-xs text-text-secondary">Descrição</label>
        <input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Ex: Aluguel, Água, Combustível..."
          className="mb-3 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
        />

        <div className="mb-3 flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Valor</label>
            <input
              type="number"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">
              {tipo === "fixa" ? "Data (define o dia de vencimento)" : "Data"}
            </label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="mb-4 flex gap-3">
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

        {error && <p className="mb-3 text-sm text-danger">{error}</p>}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-btn px-4 py-2 text-sm text-text-secondary hover:text-text"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-4 py-2 text-sm font-semibold text-bg disabled:opacity-60"
          >
            {saving ? "Lançando..." : "Lançar"}
          </button>
        </div>
      </form>
    </div>
  );
}

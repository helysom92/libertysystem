"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DespesaFixa, DespesaVariavel, Fornecedor } from "@/lib/domain/types";
import { todayISO } from "@/lib/domain/dates";
import { lancarDespesaExistente, lancarNovaDespesa } from "@/lib/actions/financeiro";

export default function NovaDespesaModal({
  fornecedores,
  despesasFixas,
  despesasVariaveis,
  onClose,
}: {
  fornecedores: Fornecedor[];
  despesasFixas: DespesaFixa[];
  despesasVariaveis: DespesaVariavel[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [tipo, setTipo] = useState<"fixa" | "variavel">("fixa");
  const [existenteId, setExistenteId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("Geral");
  const [fornecedorId, setFornecedorId] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const opcoesExistentes = tipo === "fixa" ? despesasFixas : despesasVariaveis;
  const existente = opcoesExistentes.find((d) => d.id === existenteId);

  function selecionarTipo(t: "fixa" | "variavel") {
    setTipo(t);
    setExistenteId("");
  }

  function selecionarExistente(id: string) {
    setExistenteId(id);
    if (!id) return;
    const d = (tipo === "fixa" ? despesasFixas : despesasVariaveis).find((x) => x.id === id);
    if (!d) return;
    setDescricao(d.descricao);
    setCategoria(d.categoria ?? "Geral");
    setFornecedorId(d.fornecedor_id ?? "");
    setValor(String("valor" in d ? d.valor : d.valor_provisionado));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!existente && !descricao.trim()) {
      setError("Dê um nome pra despesa, ou selecione uma já cadastrada.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (existente) {
        await lancarDespesaExistente({ tipo, despesaId: existente.id, valor: Number(valor) || 0, data });
      } else {
        await lancarNovaDespesa({
          tipo,
          descricao,
          categoria,
          fornecedor_id: fornecedorId || null,
          valor: Number(valor) || 0,
          data,
        });
      }
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
              onClick={() => selecionarTipo(t)}
              className={`flex-1 rounded-btn border py-2 text-sm capitalize ${
                tipo === t ? "border-gold bg-gold/10 text-gold" : "border-border-neutral text-text-secondary"
              }`}
            >
              {t === "fixa" ? "Fixa (repete todo mês)" : "Variável (valor muda)"}
            </button>
          ))}
        </div>

        {opcoesExistentes.length > 0 && (
          <>
            <label className="mb-1 block text-xs text-text-secondary">
              Despesa recorrente já cadastrada (opcional)
            </label>
            <select
              value={existenteId}
              onChange={(e) => selecionarExistente(e.target.value)}
              className="mb-3 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            >
              <option value="">— Criar nova —</option>
              {opcoesExistentes.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.descricao}
                </option>
              ))}
            </select>
          </>
        )}

        <label className="mb-1 block text-xs text-text-secondary">Descrição</label>
        <input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          disabled={!!existente}
          placeholder="Ex: Aluguel, Água, Combustível..."
          className="mb-3 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm disabled:opacity-60"
        />

        <div className="mb-3 flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Valor</label>
            <input
              type="number"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              disabled={!!existente && tipo === "fixa"}
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm disabled:opacity-60"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">
              {tipo === "fixa" && !existente ? "Data (define o dia de vencimento)" : "Data"}
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
              disabled={!!existente}
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm disabled:opacity-60"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Fornecedor</label>
            <select
              value={fornecedorId}
              onChange={(e) => setFornecedorId(e.target.value)}
              disabled={!!existente}
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm disabled:opacity-60"
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

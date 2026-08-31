"use client";

import { useState, useTransition } from "react";
import type { ContaPessoal, OrigemReceitaPessoal, ReceitaPessoal, RecorrenciaPessoal } from "@/lib/domain/types";
import { createReceita, updateReceita } from "@/lib/actions/financasPessoais";

const RECORRENCIAS: { value: RecorrenciaPessoal; label: string }[] = [
  { value: "unica", label: "Única" },
  { value: "mensal", label: "Mensal" },
  { value: "semanal", label: "Semanal" },
  { value: "anual", label: "Anual" },
];

export default function NovaReceitaModal({
  contas,
  origens,
  receita,
  onClose,
}: {
  contas: ContaPessoal[];
  origens: OrigemReceitaPessoal[];
  receita?: ReceitaPessoal;
  onClose: () => void;
}) {
  const [descricao, setDescricao] = useState(receita?.descricao ?? "");
  const [origemId, setOrigemId] = useState(receita?.origem_id ?? origens[0]?.id ?? "");
  const [pagador, setPagador] = useState(receita?.pagador ?? "");
  const [categoria, setCategoria] = useState(receita?.categoria ?? "");
  const [valor, setValor] = useState(String(receita?.valor_previsto ?? ""));
  const [contaDestinoId, setContaDestinoId] = useState(receita?.conta_destino_id ?? contas[0]?.id ?? "");
  const [dataPrevista, setDataPrevista] = useState(receita?.data_prevista ?? "");
  const [recorrencia, setRecorrencia] = useState<RecorrenciaPessoal>(receita?.recorrencia ?? "unica");
  const [observacoes, setObservacoes] = useState(receita?.observacoes ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const valorNum = Number(valor.replace(",", "."));
    if (!descricao.trim()) {
      setError("Descrição é obrigatória.");
      return;
    }
    if (!valorNum || valorNum <= 0) {
      setError("Informe um valor maior que zero.");
      return;
    }
    const input = {
      descricao: descricao.trim(),
      origem_id: origemId || null,
      pagador: pagador.trim() || null,
      categoria: categoria.trim() || null,
      valor_previsto: valorNum,
      conta_destino_id: contaDestinoId || null,
      data_prevista: dataPrevista || null,
      recorrencia,
      observacoes: observacoes.trim() || null,
    };
    startTransition(async () => {
      try {
        if (receita) await updateReceita(receita.id, input);
        else await createReceita(input);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível salvar essa receita.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-card border border-border-gold bg-card p-6"
      >
        <h2 className="mb-4 font-display text-lg font-bold">{receita ? "Editar Receita" : "Nova Receita"}</h2>

        <label className="mb-1 block text-xs text-text-secondary">Descrição</label>
        <input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className="mb-3 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
        />

        <div className="mb-3 flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Origem</label>
            <select
              value={origemId}
              onChange={(e) => setOrigemId(e.target.value)}
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {origens.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Pagador (opcional)</label>
            <input
              value={pagador}
              onChange={(e) => setPagador(e.target.value)}
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            />
          </div>
        </div>

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
            <label className="mb-1 block text-xs text-text-secondary">Valor previsto</label>
            <input
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              inputMode="decimal"
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="mb-3 flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Conta de destino</label>
            <select
              value={contaDestinoId}
              onChange={(e) => setContaDestinoId(e.target.value)}
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Data prevista</label>
            <input
              type="date"
              value={dataPrevista}
              onChange={(e) => setDataPrevista(e.target.value)}
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            />
          </div>
        </div>

        <label className="mb-1 block text-xs text-text-secondary">Recorrência</label>
        <select
          value={recorrencia}
          onChange={(e) => setRecorrencia(e.target.value as RecorrenciaPessoal)}
          className="mb-3 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
        >
          {RECORRENCIAS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>

        <label className="mb-1 block text-xs text-text-secondary">Observações</label>
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={2}
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
            {pending ? "Salvando..." : receita ? "Salvar" : "Criar Receita"}
          </button>
        </div>
      </form>
    </div>
  );
}

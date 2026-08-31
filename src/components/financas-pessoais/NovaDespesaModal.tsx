"use client";

import { useState, useTransition } from "react";
import type { ContaPessoal, DespesaPessoal, RecorrenciaPessoal } from "@/lib/domain/types";
import { createDespesa, updateDespesa } from "@/lib/actions/financasPessoais";

const RECORRENCIAS: { value: RecorrenciaPessoal; label: string }[] = [
  { value: "unica", label: "Única" },
  { value: "mensal", label: "Mensal" },
  { value: "semanal", label: "Semanal" },
  { value: "anual", label: "Anual" },
];

export default function NovaDespesaModal({
  contas,
  despesa,
  onClose,
}: {
  contas: ContaPessoal[];
  despesa?: DespesaPessoal;
  onClose: () => void;
}) {
  const [descricao, setDescricao] = useState(despesa?.descricao ?? "");
  const [categoria, setCategoria] = useState(despesa?.categoria ?? "");
  const [favorecido, setFavorecido] = useState(despesa?.favorecido ?? "");
  const [valor, setValor] = useState(String(despesa?.valor_previsto ?? ""));
  const [contaId, setContaId] = useState(despesa?.conta_id ?? contas[0]?.id ?? "");
  const [vencimento, setVencimento] = useState(despesa?.vencimento ?? "");
  const [recorrencia, setRecorrencia] = useState<RecorrenciaPessoal>(despesa?.recorrencia ?? "unica");
  const [observacoes, setObservacoes] = useState(despesa?.observacoes ?? "");
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
      categoria: categoria.trim() || null,
      favorecido: favorecido.trim() || null,
      valor_previsto: valorNum,
      conta_id: contaId || null,
      vencimento: vencimento || null,
      recorrencia,
      observacoes: observacoes.trim() || null,
    };
    startTransition(async () => {
      try {
        if (despesa) await updateDespesa(despesa.id, input);
        else await createDespesa(input);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível salvar essa despesa.");
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
        <h2 className="mb-4 font-display text-lg font-bold">{despesa ? "Editar Despesa" : "Nova Despesa"}</h2>

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
            <label className="mb-1 block text-xs text-text-secondary">Favorecido</label>
            <input
              value={favorecido}
              onChange={(e) => setFavorecido(e.target.value)}
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="mb-3 flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Valor previsto</label>
            <input
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              inputMode="decimal"
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Conta</label>
            <select
              value={contaId}
              onChange={(e) => setContaId(e.target.value)}
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
        </div>

        <div className="mb-3 flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Vencimento</label>
            <input
              type="date"
              value={vencimento}
              onChange={(e) => setVencimento(e.target.value)}
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Recorrência</label>
            <select
              value={recorrencia}
              onChange={(e) => setRecorrencia(e.target.value as RecorrenciaPessoal)}
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            >
              {RECORRENCIAS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>

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
            {pending ? "Salvando..." : despesa ? "Salvar" : "Criar Despesa"}
          </button>
        </div>
      </form>
    </div>
  );
}

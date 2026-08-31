"use client";

import { useState, useTransition } from "react";
import type { ServicoDetail } from "@/lib/domain/types";
import { addChecklistItem, removeChecklistItem, toggleChecklistItem } from "@/lib/actions/servicoDetail";

export default function ChecklistTab({
  detail,
  onChanged,
}: {
  detail: ServicoDetail;
  onChanged: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function showError(message: string | undefined, fallback: string) {
    setError(message ?? fallback);
    setTimeout(() => setError(null), 6000);
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    startTransition(async () => {
      const resultado = await addChecklistItem(detail.servico.id, texto.trim());
      if (!resultado.ok) {
        showError(resultado.message, "Não foi possível adicionar esse item.");
      } else {
        setTexto("");
        onChanged();
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="rounded-btn border border-danger-border bg-card px-3 py-2 text-[12.5px] text-danger">
          {error}
        </p>
      )}
      <form onSubmit={add} className="flex gap-2">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Novo item"
          className="flex-1 rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-4 py-2 text-sm font-semibold text-bg"
        >
          Adicionar
        </button>
      </form>

      <div className="flex flex-col gap-1.5">
        {detail.checklist.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between rounded-card border border-border-neutral bg-card-secondary px-3 py-2 text-[13px]"
          >
            <label className="flex flex-1 items-center gap-2">
              <input
                type="checkbox"
                checked={item.done}
                onChange={(e) =>
                  startTransition(async () => {
                    const resultado = await toggleChecklistItem(item.id, e.target.checked);
                    if (!resultado.ok) {
                      showError(resultado.message, "Não foi possível marcar esse item.");
                    } else {
                      onChanged();
                    }
                  })
                }
              />
              <span className={item.done ? "text-text-muted line-through" : ""}>{item.texto}</span>
            </label>
            <button
              type="button"
              onClick={() =>
                startTransition(async () => {
                  const resultado = await removeChecklistItem(item.id);
                  if (!resultado.ok) {
                    showError(resultado.message, "Não foi possível remover esse item.");
                  } else {
                    onChanged();
                  }
                })
              }
              className="text-danger"
            >
              ✕
            </button>
          </div>
        ))}
        {detail.checklist.length === 0 && (
          <p className="text-sm text-text-muted">Nenhum item no checklist.</p>
        )}
      </div>
    </div>
  );
}

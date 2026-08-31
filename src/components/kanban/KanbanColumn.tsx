"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useDroppable } from "@dnd-kit/core";
import { deleteColuna, renameColuna, toggleConclusaoColuna } from "@/lib/actions/kanban";
import type { Coluna } from "@/lib/domain/kanban";
import type { Servico } from "@/lib/domain/types";
import ServicoCard from "./ServicoCard";

export default function KanbanColumn({
  coluna,
  items,
  onOpen,
  capaUrls,
  checklistProgress,
  hideValores,
}: {
  coluna: Coluna;
  items: Servico[];
  onOpen: (id: string) => void;
  capaUrls: Record<string, string>;
  checklistProgress: Record<string, { done: number; total: number }>;
  hideValores?: boolean;
}) {
  const router = useRouter();
  const { setNodeRef, isOver } = useDroppable({ id: coluna.id });
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(coluna.label);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const LIMITE = 6;
  const visiveis = expanded ? items : items.slice(0, LIMITE);
  const restantes = items.length - visiveis.length;

  function showError(err: unknown, fallback: string) {
    console.error(fallback, err);
    setError(err instanceof Error ? err.message : fallback);
    setTimeout(() => setError(null), 5000);
  }

  function saveLabel() {
    setEditing(false);
    if (label.trim() && label !== coluna.label) {
      startTransition(async () => {
        const resultado = await renameColuna(coluna.id, label.trim());
        if (!resultado.ok) {
          showError(null, resultado.message);
          setLabel(coluna.label);
        } else {
          router.refresh();
        }
      });
    } else {
      setLabel(coluna.label);
    }
  }

  function handleDelete() {
    startTransition(async () => {
      const resultado = await deleteColuna(coluna.id);
      if (!resultado.ok) {
        showError(null, resultado.message ?? "Não foi possível apagar essa coluna.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col rounded-card border p-3 transition-colors ${
        isOver ? "border-gold" : "border-border-neutral"
      }`}
      style={{
        backgroundColor: coluna.is_conclusao ? "rgba(201,162,75,0.06)" : "var(--color-card-secondary)",
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-1.5">
        {editing ? (
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={saveLabel}
            onKeyDown={(e) => e.key === "Enter" && saveLabel()}
            autoFocus
            className="flex-1 rounded-btn border border-border-gold-strong bg-bg px-1.5 py-1 font-display text-[12px] font-bold text-gold outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="Clique para renomear"
            className="flex-1 truncate text-left text-[11px] font-bold tracking-wide text-gold uppercase"
          >
            {coluna.label}
          </button>
        )}
        <div className="flex items-center gap-1.5">
          {coluna.is_conclusao && (
            <span className="text-[10px] text-gold" title="Coluna de conclusão">★</span>
          )}
          <span className="rounded-pill bg-black/30 px-1.5 py-0.5 text-[11px] text-text-muted">
            {items.length}
          </span>
          {editing && (
            <>
              <button
                type="button"
                onClick={() =>
                  startTransition(async () => {
                    const resultado = await toggleConclusaoColuna(coluna.id, !coluna.is_conclusao);
                    if (!resultado.ok) {
                      showError(null, resultado.message);
                    } else {
                      router.refresh();
                    }
                  })
                }
                title={coluna.is_conclusao ? "Remover marca de conclusão" : "Marcar como coluna de conclusão"}
                className="text-[11px] text-text-secondary hover:text-gold"
              >
                ★
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={pending}
                className="text-[14px] leading-none text-danger/70 hover:text-danger"
              >
                ✕
              </button>
            </>
          )}
        </div>
      </div>

      {error && <p className="mb-2 text-[11px] text-danger">{error}</p>}

      <div className="flex flex-col gap-3">
        {visiveis.map((s) => (
          <ServicoCard
            key={s.id}
            servico={s}
            onOpen={onOpen}
            capaUrl={capaUrls[s.id] ?? null}
            checklistProgress={checklistProgress[s.id] ?? null}
            hideValores={hideValores}
          />
        ))}
      </div>

      {restantes > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-3 w-full rounded-btn border border-border-neutral py-2 text-[12px] text-text-secondary hover:text-text"
        >
          Ver mais {restantes}
        </button>
      )}
      {expanded && items.length > LIMITE && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mt-2 w-full rounded-btn border border-border-neutral py-2 text-[12px] text-text-secondary hover:text-text"
        >
          Ver menos
        </button>
      )}
    </div>
  );
}

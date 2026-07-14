"use client";

import { useDroppable } from "@dnd-kit/core";
import { faseDaEtapa } from "@/lib/domain/flows";
import type { Servico } from "@/lib/domain/types";
import ServicoCard from "./ServicoCard";

export default function KanbanColumn({
  estagio,
  items,
  onOpen,
  capaUrls,
  checklistProgress,
}: {
  estagio: string;
  items: Servico[];
  onOpen: (id: string) => void;
  capaUrls: Record<string, string>;
  checklistProgress: Record<string, { done: number; total: number }>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: estagio });
  const fase = faseDaEtapa(estagio);

  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col rounded-card border p-3 transition-colors ${
        isOver ? "border-gold" : "border-border-neutral"
      }`}
      style={{
        backgroundColor: fase === "producao" ? "rgba(201,162,75,0.06)" : "var(--color-card-secondary)",
      }}
    >
      <p className="mb-3 flex items-center gap-1.5 px-1 text-[11px] font-semibold tracking-wide text-text-secondary uppercase">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: fase === "producao" ? "#C9A24B" : "rgba(244,242,236,0.35)" }}
        />
        {estagio} · {items.length}
      </p>
      <div className="flex flex-col gap-3">
        {items.map((s) => (
          <ServicoCard
            key={s.id}
            servico={s}
            onOpen={onOpen}
            capaUrl={capaUrls[s.id] ?? null}
            checklistProgress={checklistProgress[s.id] ?? null}
          />
        ))}
      </div>
    </div>
  );
}

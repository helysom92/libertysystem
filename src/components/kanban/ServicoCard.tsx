"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { dcComplete, flowFor } from "@/lib/domain/flows";
import { fmtBRL, type Servico } from "@/lib/domain/types";
import FinanceiroBadge from "@/components/ui/FinanceiroBadge";
import { moveServico } from "@/lib/actions/servicos";
import { useTransition } from "react";

export default function ServicoCard({
  servico,
  onOpen,
  capaUrl,
  checklistProgress,
}: {
  servico: Servico;
  onOpen: (id: string) => void;
  capaUrl?: string | null;
  checklistProgress?: { done: number; total: number } | null;
}) {
  const [pending, startTransition] = useTransition();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: servico.id,
  });
  const flow = flowFor(servico.tipo);
  const idx = flow.indexOf(servico.estagio);
  const noBack = idx <= 0;
  const noAdvance = idx >= flow.length - 1;
  const blockedByDC =
    servico.estagio === "Double Check de Medidas" &&
    !dcComplete(servico.dc_admin, servico.dc_producao);

  function move(dir: 1 | -1) {
    startTransition(() => {
      moveServico(servico.id, dir);
    });
  }

  const style = transform
    ? { transform: CSS.Translate.toString(transform), zIndex: 50 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`overflow-hidden rounded-card border border-border-gold bg-card ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      {capaUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={capaUrl}
          alt=""
          {...attributes}
          {...listeners}
          className="h-24 w-full cursor-grab object-cover active:cursor-grabbing"
        />
      )}
      <div className="p-3.5">
        <div
          {...(capaUrl ? {} : { ...attributes, ...listeners })}
          className={capaUrl ? "" : "cursor-grab active:cursor-grabbing"}
        >
          <button
            type="button"
            onClick={() => onOpen(servico.id)}
            onPointerDown={(e) => e.stopPropagation()}
            className="mb-1 block w-full text-left text-[15px] font-semibold text-text hover:text-gold"
          >
            {servico.cliente}
          </button>
          <p className="mb-2 text-[12.5px] text-text-secondary">{servico.descricao}</p>
        </div>
        <div className="mb-2 flex items-center gap-2">
          <span className="font-display text-[14px] font-bold text-gradient-gold">
            {fmtBRL(servico.valor)}
          </span>
          <FinanceiroBadge status={servico.financeiro_status} />
          {checklistProgress && checklistProgress.total > 0 && (
            <span className="ml-auto rounded-pill border border-border-neutral px-2 py-0.5 text-[10.5px] text-text-secondary">
              ☑ {checklistProgress.done}/{checklistProgress.total}
            </span>
          )}
        </div>
        <p className="mb-3 truncate text-[11.5px] text-text-muted">
          › {servico.proxima_acao_texto || "Sem próxima ação"}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={noBack || pending}
            onClick={() => move(-1)}
            className="flex-1 rounded-btn border border-border-neutral py-1.5 text-xs text-text-secondary disabled:opacity-30"
          >
            ◀
          </button>
          <button
            type="button"
            disabled={noAdvance || pending || blockedByDC}
            onClick={() => move(1)}
            title={blockedByDC ? "Double Check pendente" : undefined}
            className="flex-1 rounded-btn border border-border-gold-strong bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark py-1.5 text-xs font-semibold text-bg disabled:opacity-30"
          >
            ▶
          </button>
        </div>
      </div>
    </div>
  );
}

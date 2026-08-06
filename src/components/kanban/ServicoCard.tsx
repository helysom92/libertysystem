"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { PRAZO_STATUS_COLOR, PRAZO_STATUS_LABEL, prazoStatus } from "@/lib/domain/kanban";
import { displayNumero, fmtBRL, type Servico } from "@/lib/domain/types";
import FinanceiroBadge from "@/components/ui/FinanceiroBadge";

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
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: servico.id,
  });

  const status = servico.numero ? prazoStatus(servico.prazo_tipo, servico.prazo) : null;

  const style = transform
    ? { transform: CSS.Translate.toString(transform), zIndex: 50 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`overflow-hidden rounded-card border border-border-gold bg-card cursor-grab active:cursor-grabbing ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      {capaUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={capaUrl} alt="" className="h-24 w-full object-cover" />
      ) : (
        <div className="flex h-16 items-center justify-center border-b border-border-neutral bg-card-secondary">
          <span className="font-mono text-[9px] tracking-wide text-text-muted uppercase">
            capa · foto da arte/projeto
          </span>
        </div>
      )}
      <div className="p-3.5">
        <p
          className="mb-0.5 text-[10px] font-semibold tracking-wide uppercase"
          style={{ color: servico.numero ? "#25D366" : "#E0A64E" }}
        >
          {displayNumero(servico)}
        </p>
        <button
          type="button"
          onClick={() => onOpen(servico.id)}
          onPointerDown={(e) => e.stopPropagation()}
          className="mb-1 block w-full text-left text-[15px] font-semibold text-text hover:text-gold"
        >
          {servico.cliente}
        </button>
        {servico.descricao && (
          <p className="mb-2 line-clamp-2 text-[12px] text-text-secondary">{servico.descricao}</p>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-pill bg-gold/10 px-2 py-0.5 text-[11px] text-gold">
            {fmtBRL(servico.valor)}
          </span>
          {checklistProgress && checklistProgress.total > 0 && (
            <span className="rounded-pill border border-border-neutral px-2 py-0.5 text-[10.5px] text-text-secondary">
              ☑ {checklistProgress.done}/{checklistProgress.total}
            </span>
          )}
          {status && (
            <span
              className="rounded-pill px-2 py-0.5 text-[10.5px] font-semibold"
              style={{ color: PRAZO_STATUS_COLOR[status], backgroundColor: `${PRAZO_STATUS_COLOR[status]}22` }}
            >
              ● {PRAZO_STATUS_LABEL[status]}
            </span>
          )}
          <FinanceiroBadge status={servico.financeiro_status} />
        </div>
      </div>
    </div>
  );
}

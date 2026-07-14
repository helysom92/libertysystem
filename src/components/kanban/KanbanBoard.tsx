"use client";

import { useMemo, useState } from "react";
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { MASTER_STAGE_ORDER, flowFor } from "@/lib/domain/flows";
import type { Cliente, ItemOrcamento, Servico } from "@/lib/domain/types";
import KanbanColumn from "./KanbanColumn";
import NovoServicoModal from "./NovoServicoModal";
import CentralDoServico from "@/components/servico-modal/CentralDoServico";
import { moveServico } from "@/lib/actions/servicos";
import type { Role } from "@/lib/domain/flows";

export default function KanbanBoard({
  servicos,
  role,
  initialOpenId,
  capaUrls,
  checklistProgress,
  itensOrcamento,
  clientes,
}: {
  servicos: Servico[];
  role: Role;
  initialOpenId?: string | null;
  capaUrls: Record<string, string>;
  checklistProgress: Record<string, { done: number; total: number }>;
  itensOrcamento: ItemOrcamento[];
  clientes: Cliente[];
}) {
  const [novoOpen, setNovoOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(initialOpenId ?? null);
  const [dragError, setDragError] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const columns = useMemo(() => {
    return MASTER_STAGE_ORDER.map((estagio) => ({
      estagio,
      items: servicos.filter((s) => s.estagio === estagio),
    })).filter((col) => col.items.length > 0);
  }, [servicos]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const servico = servicos.find((s) => s.id === active.id);
    const targetEstagio = String(over.id);
    if (!servico || servico.estagio === targetEstagio) return;

    const flow = flowFor(servico.tipo);
    const currentIdx = flow.indexOf(servico.estagio);
    const targetIdx = flow.indexOf(targetEstagio);

    if (targetIdx === -1 || Math.abs(targetIdx - currentIdx) !== 1) {
      setDragError("Mova uma etapa por vez — arraste para uma coluna vizinha na sequência do serviço.");
      setTimeout(() => setDragError(null), 3000);
      return;
    }

    moveServico(servico.id, targetIdx > currentIdx ? 1 : -1);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display text-xl font-bold">Serviços</h1>
          <p className="text-[13px] text-text-secondary">Todo serviço nasce, evolui e termina aqui</p>
        </div>
        <button
          type="button"
          onClick={() => setNovoOpen(true)}
          className="rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-4 py-2 text-sm font-semibold text-bg"
        >
          + Novo Serviço
        </button>
      </div>

      {dragError && (
        <p className="mb-3 rounded-btn border border-danger-border bg-card px-3 py-2 text-[12.5px] text-danger">
          {dragError}
        </p>
      )}

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
          {columns.map((col) => (
            <KanbanColumn
              key={col.estagio}
              estagio={col.estagio}
              items={col.items}
              onOpen={setOpenId}
              capaUrls={capaUrls}
              checklistProgress={checklistProgress}
            />
          ))}
          {columns.length === 0 && (
            <p className="text-sm text-text-muted">Nenhum serviço ainda. Crie o primeiro.</p>
          )}
        </div>
      </DndContext>

      {novoOpen && (
        <NovoServicoModal
          itensOrcamento={itensOrcamento}
          clientes={clientes}
          onClose={() => setNovoOpen(false)}
        />
      )}
      {openId && (
        <CentralDoServico servicoId={openId} role={role} onClose={() => setOpenId(null)} />
      )}
    </div>
  );
}

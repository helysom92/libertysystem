"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { createColuna, moveCardParaColuna } from "@/lib/actions/kanban";
import type { Coluna, KanbanBoardKey } from "@/lib/domain/kanban";
import type { Cliente, ItemOrcamento, Servico } from "@/lib/domain/types";
import KanbanColumn from "./KanbanColumn";
import NovoServicoModal from "./NovoServicoModal";
import CentralDoServico from "@/components/servico-modal/CentralDoServico";
import type { Role } from "@/lib/domain/flows";

const BOARD_LABELS: Record<KanbanBoardKey, string> = {
  orcamento: "Orçamentos",
  os: "Ordens de Serviço",
};

export default function KanbanBoard({
  servicos,
  colunas,
  role,
  initialOpenId,
  capaUrls,
  checklistProgress,
  itensOrcamento,
  clientes,
}: {
  servicos: Servico[];
  colunas: Coluna[];
  role: Role;
  initialOpenId?: string | null;
  capaUrls: Record<string, string>;
  checklistProgress: Record<string, { done: number; total: number }>;
  itensOrcamento: ItemOrcamento[];
  clientes: Cliente[];
}) {
  const router = useRouter();
  const [board, setBoard] = useState<KanbanBoardKey>("orcamento");
  const [novoOpen, setNovoOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(initialOpenId ?? null);
  const [dragError, setDragError] = useState<string | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColText, setNewColText] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const columns = useMemo(() => {
    return colunas
      .filter((c) => c.board === board)
      .sort((a, b) => a.ordem - b.ordem)
      .map((coluna) => ({
        coluna,
        items: servicos.filter((s) => s.coluna_id === coluna.id),
      }));
  }, [colunas, servicos, board]);

  function showDragError(msg: string) {
    setDragError(msg);
    setTimeout(() => setDragError(null), 5000);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const servico = servicos.find((s) => s.id === active.id);
    const targetColunaId = String(over.id);
    if (!servico || servico.coluna_id === targetColunaId) return;

    moveCardParaColuna(servico.id, targetColunaId)
      .then((result) => {
        if (!result.ok) {
          showDragError(result.reason ?? "Não foi possível mover esse card.");
          return;
        }
        router.refresh();
      })
      .catch((err) => {
        console.error("Falha ao mover card", err);
        showDragError(err instanceof Error ? err.message : "Não foi possível mover esse card.");
      });
  }

  function submitNewColumn() {
    const text = newColText.trim();
    if (!text) return;
    createColuna(board, text)
      .then(() => {
        setAddingColumn(false);
        setNewColText("");
        router.refresh();
      })
      .catch((err) => {
        console.error("Falha ao criar coluna", err);
        showDragError(err instanceof Error ? err.message : "Não foi possível criar a coluna.");
      });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold">Serviços</h1>
          <p className="text-[13px] text-text-secondary">Todo serviço nasce, evolui e termina aqui</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            {(Object.keys(BOARD_LABELS) as KanbanBoardKey[]).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBoard(b)}
                className={`rounded-btn border px-3.5 py-1.5 text-[13px] font-semibold ${
                  board === b
                    ? "border-transparent bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark text-bg"
                    : "border-border-gold text-text-secondary"
                }`}
              >
                {BOARD_LABELS[b]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setNovoOpen(true)}
            className="rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-4 py-2 text-sm font-semibold text-bg"
          >
            + Novo Orçamento
          </button>
        </div>
      </div>

      {dragError && (
        <p className="mb-3 rounded-btn border border-danger-border bg-card px-3 py-2 text-[12.5px] text-danger">
          {dragError}
        </p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
          {columns.map((col) => (
            <KanbanColumn
              key={col.coluna.id}
              coluna={col.coluna}
              items={col.items}
              onOpen={setOpenId}
              capaUrls={capaUrls}
              checklistProgress={checklistProgress}
            />
          ))}

          <div className="w-56 shrink-0">
            {addingColumn ? (
              <div className="flex flex-col gap-1.5 rounded-card border border-dashed border-border-gold-strong bg-card-secondary/50 p-3">
                <input
                  value={newColText}
                  onChange={(e) => setNewColText(e.target.value)}
                  placeholder="Nome da etapa"
                  autoFocus
                  className="rounded-btn border border-border-gold-strong bg-bg px-2 py-1.5 text-[12px] text-text outline-none"
                />
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={submitNewColumn}
                    className="flex-1 rounded-btn bg-gold py-1.5 text-[12px] font-semibold text-bg"
                  >
                    Criar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingColumn(false);
                      setNewColText("");
                    }}
                    className="rounded-btn border border-border-neutral px-2 py-1.5 text-[12px] text-text-secondary"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingColumn(true)}
                className="h-11 w-full rounded-card border border-dashed border-border-gold-strong text-[13px] text-text-secondary"
              >
                + Nova etapa
              </button>
            )}
          </div>

          {columns.length === 0 && !addingColumn && (
            <p className="text-sm text-text-muted">Nenhuma coluna nesse quadro ainda.</p>
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
        <CentralDoServico
          servicoId={openId}
          role={role}
          itensOrcamento={itensOrcamento}
          colunasOS={colunas.filter((c) => c.board === "os").sort((a, b) => a.ordem - b.ordem)}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

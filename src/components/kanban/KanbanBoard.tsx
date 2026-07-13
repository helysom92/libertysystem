"use client";

import { useMemo, useState } from "react";
import { MASTER_STAGE_ORDER } from "@/lib/domain/flows";
import type { Servico } from "@/lib/domain/types";
import ServicoCard from "./ServicoCard";
import NovoServicoModal from "./NovoServicoModal";
import CentralDoServico from "@/components/servico-modal/CentralDoServico";
import type { Role } from "@/lib/domain/flows";

export default function KanbanBoard({
  servicos,
  role,
  initialOpenId,
}: {
  servicos: Servico[];
  role: Role;
  initialOpenId?: string | null;
}) {
  const [novoOpen, setNovoOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(initialOpenId ?? null);

  const columns = useMemo(() => {
    return MASTER_STAGE_ORDER.map((estagio) => ({
      estagio,
      items: servicos.filter((s) => s.estagio === estagio),
    })).filter((col) => col.items.length > 0);
  }, [servicos]);

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

      <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
        {columns.map((col) => (
          <div
            key={col.estagio}
            className="flex w-72 shrink-0 flex-col rounded-card border border-border-neutral bg-card-secondary p-3"
          >
            <p className="mb-3 px-1 text-[11px] font-semibold tracking-wide text-text-secondary uppercase">
              {col.estagio} · {col.items.length}
            </p>
            <div className="flex flex-col gap-3">
              {col.items.map((s) => (
                <ServicoCard key={s.id} servico={s} onOpen={setOpenId} />
              ))}
            </div>
          </div>
        ))}
        {columns.length === 0 && (
          <p className="text-sm text-text-muted">Nenhum serviço ainda. Crie o primeiro.</p>
        )}
      </div>

      {novoOpen && <NovoServicoModal onClose={() => setNovoOpen(false)} />}
      {openId && (
        <CentralDoServico servicoId={openId} role={role} onClose={() => setOpenId(null)} />
      )}
    </div>
  );
}

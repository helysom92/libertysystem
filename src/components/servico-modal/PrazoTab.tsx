"use client";

import { useTransition, useState } from "react";
import type { ServicoDetail } from "@/lib/domain/types";
import { PRAZO_STATUS_COLOR, PRAZO_STATUS_LABEL, PRAZO_TIPO_INFO, prazoStatus, type PrazoTipo } from "@/lib/domain/kanban";
import { fmtDatePtBR } from "@/lib/domain/dates";
import { updatePrazoServico } from "@/lib/actions/servicos";

const PRAZO_TIPOS: PrazoTipo[] = ["balcao", "fachada", "complexo"];

export default function PrazoTab({
  detail,
  onChanged,
}: {
  detail: ServicoDetail;
  onChanged: () => void;
}) {
  const { servico } = detail;
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const status = servico.prazo_tipo ? prazoStatus(servico.prazo_tipo, servico.prazo) : null;

  function setTipo(t: PrazoTipo) {
    setError(null);
    startTransition(async () => {
      try {
        await updatePrazoServico(servico.id, t);
        onChanged();
      } catch (err) {
        console.error("Falha ao atualizar prazo", err);
        setError(err instanceof Error ? err.message : "Não foi possível atualizar o prazo.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-card border border-border-gold-strong bg-card-secondary p-3">
        <p className="mb-2 text-[10.5px] tracking-wide text-text-muted uppercase">Prazo do serviço</p>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {PRAZO_TIPOS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className={`rounded-pill border px-3 py-1.5 text-[11.5px] font-semibold ${
                servico.prazo_tipo === t
                  ? "border-transparent bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark text-bg"
                  : "border-border-gold-strong text-text-secondary"
              }`}
            >
              {PRAZO_TIPO_INFO[t].label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {status && (
            <span
              className="rounded-pill px-2 py-0.5 text-[11px] font-semibold"
              style={{ color: PRAZO_STATUS_COLOR[status], backgroundColor: `${PRAZO_STATUS_COLOR[status]}22` }}
            >
              ● {PRAZO_STATUS_LABEL[status]}
            </span>
          )}
          <span className="text-[12px] text-text-secondary">
            {servico.prazo_inicio && servico.prazo
              ? `Início ${fmtDatePtBR(servico.prazo_inicio)} · Prazo ${fmtDatePtBR(servico.prazo)}`
              : "Selecione o tipo de prazo"}
          </span>
        </div>
        {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
      </div>
    </div>
  );
}

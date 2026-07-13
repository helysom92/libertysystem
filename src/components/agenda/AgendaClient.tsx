"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { addDays, fmtDateLabel, fmtDatePtBR } from "@/lib/domain/dates";
import type { Evento } from "@/lib/domain/types";
import NovoEventoModal from "./NovoEventoModal";
import { deleteEvento } from "@/lib/actions/eventos";

export default function AgendaClient({ data, eventos }: { data: string; eventos: Evento[] }) {
  const router = useRouter();
  const [novoOpen, setNovoOpen] = useState(false);

  function goTo(newDate: string) {
    router.push(`/agenda?data=${newDate}`);
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display text-xl font-bold">Agenda</h1>
          <p className="text-[13px] text-text-secondary">Compromissos do dia</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-btn border border-border-neutral px-1 py-1">
            <button
              type="button"
              onClick={() => goTo(addDays(data, -1))}
              className="rounded-btn px-2 py-1 text-sm text-text-secondary hover:text-text"
            >
              ◀
            </button>
            <span className="px-2 text-sm">{fmtDatePtBR(data)}</span>
            <button
              type="button"
              onClick={() => goTo(addDays(data, 1))}
              className="rounded-btn px-2 py-1 text-sm text-text-secondary hover:text-text"
            >
              ▶
            </button>
          </div>
          <button
            type="button"
            onClick={() => setNovoOpen(true)}
            className="rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-4 py-2 text-sm font-semibold text-bg"
          >
            + Novo Evento
          </button>
        </div>
      </div>

      <p className="mb-3 text-[11px] font-semibold tracking-wide text-text-secondary uppercase">
        {fmtDateLabel(data)}
      </p>

      <div className="flex flex-col gap-3">
        {eventos.map((ev) => (
          <div
            key={ev.id}
            className="flex items-center justify-between rounded-card border border-border-neutral bg-card px-4 py-3"
          >
            <div className="flex items-center gap-4">
              <span className="font-display w-14 text-lg font-bold text-gold">{ev.hora.slice(0, 5)}</span>
              <div>
                <p className="text-sm font-semibold">
                  {ev.tipo} — {ev.cliente}
                </p>
                <p className="text-[12px] text-text-secondary">
                  {ev.endereco} · Responsável: {ev.responsavel || "—"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {ev.whatsapp && (
                <a
                  href={`https://wa.me/55${ev.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-btn border border-border-neutral px-3 py-1.5 text-[12px]"
                  style={{ color: "#25D366" }}
                >
                  WhatsApp
                </a>
              )}
              {ev.servico_id && (
                <a
                  href="/servicos"
                  className="rounded-btn border border-border-gold-strong px-3 py-1.5 text-[12px] text-gold"
                >
                  Abrir Serviço
                </a>
              )}
              <button
                type="button"
                onClick={() => deleteEvento(ev.id)}
                className="text-[12px] text-text-muted hover:text-danger"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
        {eventos.length === 0 && (
          <p className="text-sm text-text-muted">Nenhum evento neste dia.</p>
        )}
      </div>

      {novoOpen && <NovoEventoModal data={data} onClose={() => setNovoOpen(false)} />}
    </div>
  );
}

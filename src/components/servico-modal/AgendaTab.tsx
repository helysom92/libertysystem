"use client";

import { useState, useTransition } from "react";
import type { ServicoDetail } from "@/lib/domain/types";
import { fmtDatePtBR } from "@/lib/domain/dates";
import { deleteEvento } from "@/lib/actions/eventos";
import NovoEventoModal from "@/components/agenda/NovoEventoModal";

export default function AgendaTab({
  detail,
  onChanged,
}: {
  detail: ServicoDetail;
  onChanged: () => void;
}) {
  const { servico, cliente, eventos } = detail;
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const ordenados = [...eventos].sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));

  function handleDelete(id: string) {
    if (!confirm("Excluir esse evento?")) return;
    setError(null);
    startTransition(async () => {
      const resultado = await deleteEvento(id);
      if (!resultado.ok) {
        setError(resultado.message);
      } else {
        onChanged();
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[10.5px] tracking-wide text-text-muted uppercase">
          Visitas técnicas, instalação e outros compromissos deste serviço
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-btn border border-border-gold-strong px-3 py-1.5 text-[12.5px] text-gold"
        >
          + Novo Evento
        </button>
      </div>

      {error && <p className="text-[12.5px] text-danger">{error}</p>}

      <div className="flex flex-col gap-2">
        {ordenados.map((ev) => (
          <div
            key={ev.id}
            className="flex items-center justify-between rounded-btn bg-card-secondary px-3 py-2 text-sm"
          >
            <div>
              <p className="font-medium">
                {ev.tipo} · {fmtDatePtBR(ev.data)} {ev.hora}
              </p>
              <p className="text-[11.5px] text-text-muted">
                {ev.responsavel || "Sem responsável"}
                {ev.endereco ? ` · ${ev.endereco}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleDelete(ev.id)}
              className="text-[11px] text-danger"
            >
              Excluir
            </button>
          </div>
        ))}
        {ordenados.length === 0 && (
          <p className="text-sm text-text-muted">Nenhum evento agendado pra esse serviço ainda.</p>
        )}
      </div>

      {open && (
        <NovoEventoModal
          data={servico.prazo ?? new Date().toISOString().slice(0, 10)}
          defaultServicoId={servico.id}
          defaultCliente={cliente.nome}
          defaultEndereco={servico.local_instalacao ?? cliente.endereco ?? ""}
          defaultWhatsapp={cliente.whatsapp ?? ""}
          onClose={() => {
            setOpen(false);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

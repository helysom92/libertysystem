"use client";

import { useState, useTransition } from "react";
import type { DespesaFixa, DespesaFixaOcorrencia } from "@/lib/domain/types";
import { fmtBRL } from "@/lib/domain/types";
import { toggleDespesaOcorrencia } from "@/lib/actions/financeiro";
import NovaDespesaFixaModal from "./NovaDespesaFixaModal";

function computeStatus(ocorrencia: DespesaFixaOcorrencia | undefined, diaVencimento: number) {
  if (ocorrencia?.pago) return "Pago";
  const today = new Date();
  if (today.getDate() > diaVencimento) return "Vencido";
  return "A Pagar";
}

const STATUS_COLOR: Record<string, string> = {
  Pago: "#25D366",
  "A Pagar": "rgba(244,242,236,0.6)",
  Vencido: "#E07A7A",
};

export default function DespesasFixasSection({
  despesas,
  ocorrencias,
  ano,
  mes,
}: {
  despesas: DespesaFixa[];
  ocorrencias: DespesaFixaOcorrencia[];
  ano: number;
  mes: number;
}) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  return (
    <div className="rounded-card border border-border-neutral bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-sm font-bold">Despesas Fixas</h3>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-btn border border-border-gold-strong px-3 py-1.5 text-[12.5px] text-gold"
        >
          + Nova Despesa Fixa
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {despesas.map((d) => {
          const ocorrencia = ocorrencias.find((o) => o.despesa_fixa_id === d.id);
          const status = computeStatus(ocorrencia, d.dia_vencimento);
          return (
            <div
              key={d.id}
              className="flex items-center justify-between rounded-btn bg-card-secondary px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">{d.descricao}</p>
                <p className="text-[11.5px] text-text-muted">
                  {d.categoria} · vence dia {d.dia_vencimento} · {fmtBRL(d.valor)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="rounded-pill px-2 py-0.5 text-[10.5px] font-semibold"
                  style={{ color: STATUS_COLOR[status] }}
                >
                  {status}
                </span>
                <label className="flex items-center gap-1.5 text-[12px]">
                  <input
                    type="checkbox"
                    checked={ocorrencia?.pago ?? false}
                    onChange={(e) =>
                      startTransition(() =>
                        toggleDespesaOcorrencia(d.id, ano, mes, e.target.checked)
                      )
                    }
                  />
                  Pago
                </label>
              </div>
            </div>
          );
        })}
        {despesas.length === 0 && (
          <p className="text-sm text-text-muted">Nenhuma despesa fixa cadastrada.</p>
        )}
      </div>

      {open && <NovaDespesaFixaModal onClose={() => setOpen(false)} />}
    </div>
  );
}

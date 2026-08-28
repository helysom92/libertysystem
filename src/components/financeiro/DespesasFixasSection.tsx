"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DespesaFixa, DespesaFixaOcorrencia, Fornecedor } from "@/lib/domain/types";
import { fmtBRL } from "@/lib/domain/types";
import { toggleDespesaOcorrencia, cancelarOcorrenciaDespesaFixa, estornarPagamentoOcorrenciaDespesaFixa } from "@/lib/actions/financeiro";
import { hojeISOOperacao } from "@/lib/domain/dates";
import NovaDespesaFixaModal from "./NovaDespesaFixaModal";

/** Vencimento como data completa (ano/mes já vêm do mês selecionado, não "hoje") — antes essa
 * função só comparava o dia do mês, ignorando ano/mês, divergindo do critério usado no resto
 * do app (`dashboardMetrics.ts`). */
function computeStatus(ocorrencia: DespesaFixaOcorrencia | undefined, diaVencimento: number, ano: number, mes: number) {
  if (ocorrencia?.cancelada_em) return "Cancelada";
  if (ocorrencia?.pago) return "Pago";
  const vencimento = `${ano}-${String(mes).padStart(2, "0")}-${String(diaVencimento).padStart(2, "0")}`;
  return vencimento < hojeISOOperacao() ? "Vencido" : "A Pagar";
}

const STATUS_COLOR: Record<string, string> = {
  Pago: "#25D366",
  "A Pagar": "rgba(244,242,236,0.6)",
  Vencido: "#E07A7A",
  Cancelada: "#8a8378",
};

export default function DespesasFixasSection({
  despesas,
  ocorrencias,
  fornecedores,
  ano,
  mes,
}: {
  despesas: DespesaFixa[];
  ocorrencias: DespesaFixaOcorrencia[];
  fornecedores: Fornecedor[];
  ano: number;
  mes: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DespesaFixa | null>(null);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleCancelar(despesaFixaId: string) {
    const motivo = prompt("Motivo do cancelamento desse mês (opcional):");
    if (motivo === null) return;
    try {
      await cancelarOcorrenciaDespesaFixa(despesaFixaId, ano, mes, motivo || null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível cancelar essa ocorrência.");
    }
  }

  async function handleEstornar(despesaFixaId: string) {
    const motivo = prompt("Motivo do estorno (opcional):");
    if (motivo === null) return;
    try {
      await estornarPagamentoOcorrenciaDespesaFixa(despesaFixaId, ano, mes, motivo || null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível estornar esse pagamento.");
    }
  }

  return (
    <div className="rounded-card border border-border-neutral bg-card p-4">
      {error && (
        <p className="mb-3 rounded-btn border border-danger-border bg-card-secondary px-3 py-2 text-[12.5px] text-danger">
          {error}
        </p>
      )}
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
          const status = computeStatus(ocorrencia, d.dia_vencimento, ano, mes);
          return (
            <div
              key={d.id}
              className="flex flex-col gap-2 rounded-btn bg-card-secondary px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <button
                type="button"
                onClick={() => setEditing(d)}
                className="text-left hover:underline"
              >
                <p className="font-medium">{d.descricao}</p>
                <p className="text-[11.5px] text-text-muted">
                  {d.categoria} · vence dia {d.dia_vencimento} · {fmtBRL(d.valor)}
                </p>
              </button>
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className="rounded-pill px-2 py-0.5 text-[10.5px] font-semibold"
                  style={{ color: STATUS_COLOR[status] }}
                >
                  {status}
                </span>
                {status !== "Cancelada" && (
                  <label className="flex items-center gap-1.5 text-[12px]">
                    <input
                      type="checkbox"
                      checked={ocorrencia?.pago ?? false}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setError(null);
                        startTransition(async () => {
                          try {
                            await toggleDespesaOcorrencia(d.id, ano, mes, checked);
                            router.refresh();
                          } catch (err) {
                            console.error("Falha ao atualizar despesa fixa", err);
                            setError(err instanceof Error ? err.message : "Não foi possível atualizar essa despesa.");
                          }
                        });
                      }}
                    />
                    Pago
                  </label>
                )}
                {status === "Pago" && (
                  <button type="button" onClick={() => handleEstornar(d.id)} className="text-[11px] text-danger">
                    Estornar
                  </button>
                )}
                {status !== "Cancelada" && status !== "Pago" && (
                  <button type="button" onClick={() => handleCancelar(d.id)} className="text-[11px] text-danger">
                    Cancelar mês
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {despesas.length === 0 && (
          <p className="text-sm text-text-muted">Nenhuma despesa fixa cadastrada.</p>
        )}
      </div>

      {open && (
        <NovaDespesaFixaModal
          fornecedores={fornecedores}
          onClose={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
      {editing && (
        <NovaDespesaFixaModal
          fornecedores={fornecedores}
          editing={editing}
          onClose={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

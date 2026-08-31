"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DespesaAtrasadaItem } from "@/lib/domain/dashboardMetrics";
import { fmtBRL } from "@/lib/domain/types";
import { todayISO } from "@/lib/domain/dates";
import { registrarPagamentoDespesaFixaOcorrencia, registrarPagamentoDespesaVariavelOcorrencia } from "@/lib/actions/financeiro";

const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** Ocorrências não pagas de meses anteriores — já saíram das pendências do mês atual
 * sozinhas, mas continuam aqui pra não se perder até serem quitadas. */
export default function DespesasAtrasadasList({ itens }: { itens: DespesaAtrasadaItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function marcarPaga(item: DespesaAtrasadaItem) {
    setError(null);
    startTransition(async () => {
      const resultado =
        item.tipo === "fixa"
          ? await registrarPagamentoDespesaFixaOcorrencia(item.despesaId, item.ano, item.mes, item.valor, todayISO())
          : await registrarPagamentoDespesaVariavelOcorrencia(item.despesaId, item.ano, item.mes, item.valor, todayISO());
      if (!resultado.ok) {
        setError(resultado.message);
      } else {
        router.refresh();
      }
    });
  }

  if (itens.length === 0) return null;

  return (
    <div className="rounded-card border border-danger-border bg-card p-4">
      <h3 className="mb-1 font-display text-sm font-bold text-danger">Despesas Atrasadas</h3>
      <p className="mb-3 text-[12px] text-text-secondary">
        Ficaram sem pagar em meses anteriores — marca como paga assim que acertar.
      </p>
      {error && (
        <p className="mb-3 rounded-btn border border-danger-border bg-card-secondary px-3 py-2 text-[12.5px] text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        {itens.map((item) => (
          <div
            key={item.ocorrenciaId}
            className="flex items-center justify-between rounded-btn bg-card-secondary px-3 py-2 text-[12.5px]"
          >
            <div>
              <p className="font-medium">{item.descricao}</p>
              <p className="text-[11px] text-text-muted">
                {MESES_ABREV[item.mes - 1]}/{item.ano}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-semibold text-danger">{fmtBRL(item.valor)}</span>
              <button
                type="button"
                disabled={pending}
                onClick={() => marcarPaga(item)}
                className="rounded-btn border border-border-gold-strong px-2.5 py-1 text-[11px] text-gold disabled:opacity-40"
              >
                Marcar paga
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

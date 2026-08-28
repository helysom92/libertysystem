"use client";

import type { IndicadorFinanceiro, RegistroIndicador } from "@/lib/domain/financas";
import { fmtBRL } from "@/lib/domain/types";
import { fmtDatePtBR } from "@/lib/domain/dates";

/** Painel de detalhamento de um cartão (Etapa 3) — a soma de `registros` sempre bate com
 * `indicador.total` por construção (vem do mesmo objeto que gerou o cartão), então não há
 * cálculo novo aqui, só exibição. Pra cartões de Resultado, passe `memoria` em vez de
 * `indicador` — mostra as partes da fórmula, nunca uma conta nova. */
export default function DetalhamentoIndicadorModal({
  titulo,
  indicador,
  memoria,
  onClose,
}: {
  titulo: string;
  indicador?: IndicadorFinanceiro;
  memoria?: { label: string; valor: number; destaque?: boolean }[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8" onClick={onClose}>
      <div
        className="flex max-h-full w-full max-w-lg flex-col rounded-card border border-border-gold bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border-neutral px-5 py-4">
          <h2 className="font-display text-base font-bold">{titulo}</h2>
          <button type="button" onClick={onClose} className="text-text-secondary hover:text-text">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {memoria ? (
            <div className="flex flex-col gap-2">
              {memoria.map((linha) => (
                <div
                  key={linha.label}
                  className={`flex items-center justify-between rounded-btn px-3 py-2 text-sm ${
                    linha.destaque ? "bg-gold/10 font-semibold text-gold" : "bg-card-secondary"
                  }`}
                >
                  <span>{linha.label}</span>
                  <span>{fmtBRL(linha.valor)}</span>
                </div>
              ))}
            </div>
          ) : indicador ? (
            <>
              <div className="mb-3 flex flex-wrap gap-1.5 text-[11px] text-text-muted">
                <span className="rounded-pill bg-card-secondary px-2 py-0.5">Critério: {indicador.criterioData}</span>
              </div>
              <div className="flex flex-col gap-1">
                {indicador.registros.length === 0 && (
                  <p className="py-6 text-center text-[13px] text-text-muted">Nenhum registro nesse período.</p>
                )}
                {indicador.registros.map((r: RegistroIndicador) => (
                  <div key={r.id} className="flex items-center justify-between rounded-btn px-3 py-2 text-[12.5px] hover:bg-card-secondary">
                    <div>
                      <p className="font-medium">{r.descricao}</p>
                      <p className="text-[11px] text-text-muted">{fmtDatePtBR(r.data)}</p>
                    </div>
                    <span className="font-semibold">{fmtBRL(r.valor)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between rounded-btn bg-gold/10 px-3 py-2 text-sm font-semibold text-gold">
                <span>Soma ({indicador.quantidade} registro{indicador.quantidade === 1 ? "" : "s"})</span>
                <span>{fmtBRL(indicador.total)}</span>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

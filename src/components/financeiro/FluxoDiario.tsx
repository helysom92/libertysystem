"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Fornecedor, Lancamento } from "@/lib/domain/types";
import { fmtBRL } from "@/lib/domain/types";
import { marcarLancamentoRealizado } from "@/lib/actions/financeiro";
import NovoLancamentoModal from "./NovoLancamentoModal";

function fmtDiaLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
}

function subtotal(lancs: Lancamento[], status: "previsto" | "realizado", tipo: "Receita" | "Despesa") {
  return lancs
    .filter((l) => l.status === status && l.tipo === tipo)
    .reduce((acc, l) => acc + l.valor, 0);
}

export default function FluxoDiario({
  lancamentos,
  fornecedores,
}: {
  lancamentos: Lancamento[];
  fornecedores: Fornecedor[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  const fornecedorNome = (id: string | null) => fornecedores.find((f) => f.id === id)?.nome ?? null;

  const grupos = useMemo(() => {
    const map = new Map<string, Lancamento[]>();
    for (const l of lancamentos) {
      map.set(l.data, [...(map.get(l.data) ?? []), l]);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [lancamentos]);

  return (
    <div className="rounded-card border border-border-neutral bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-sm font-bold">Fluxo Financeiro</h3>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-3 py-1.5 text-[12.5px] font-semibold text-bg"
        >
          + Novo Lançamento
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {grupos.map(([data, lancs]) => {
          const previstoReceita = subtotal(lancs, "previsto", "Receita");
          const previstoDespesa = subtotal(lancs, "previsto", "Despesa");
          const realizadoReceita = subtotal(lancs, "realizado", "Receita");
          const realizadoDespesa = subtotal(lancs, "realizado", "Despesa");

          return (
            <div key={data}>
              <div className="mb-1.5 flex items-center justify-between rounded-btn bg-card-secondary px-3 py-1.5">
                <p className="text-[11.5px] font-semibold capitalize text-text-secondary">
                  {fmtDiaLabel(data)}
                </p>
                <div className="flex gap-4 text-[11px]">
                  {(previstoReceita > 0 || previstoDespesa > 0) && (
                    <span className="text-text-muted">
                      Previsto: {fmtBRL(previstoReceita - previstoDespesa)}
                    </span>
                  )}
                  <span style={{ color: realizadoReceita - realizadoDespesa >= 0 ? "#25D366" : "#E07A7A" }}>
                    Realizado: {fmtBRL(realizadoReceita - realizadoDespesa)}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                {lancs.map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center justify-between rounded-btn px-3 py-2 text-[12.5px] hover:bg-card-secondary"
                  >
                    <div>
                      <p className="font-medium">{l.descricao}</p>
                      <p className="text-[11px] text-text-muted">
                        {fornecedorNome(l.fornecedor_id) ?? l.categoria} · {l.banco || "—"} ·{" "}
                        {l.forma_pagamento || "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className="rounded-pill px-2 py-0.5 text-[10.5px]"
                        style={{
                          color: l.status === "realizado" ? "#25D366" : "#E0A64E",
                          border: "1px solid currentColor",
                        }}
                      >
                        {l.status === "realizado" ? "Realizado" : "Previsto"}
                      </span>
                      <span
                        className={`w-24 text-right font-semibold ${
                          l.tipo === "Despesa" ? "text-danger" : "text-success"
                        }`}
                      >
                        {l.tipo === "Despesa" ? "- " : ""}
                        {fmtBRL(l.valor)}
                      </span>
                      {l.status === "previsto" && (
                        <button
                          type="button"
                          onClick={() =>
                            startTransition(async () => {
                              await marcarLancamentoRealizado(l.id);
                              router.refresh();
                            })
                          }
                          className="rounded-btn border border-border-gold-strong px-2 py-1 text-[11px] text-gold"
                        >
                          Marcar realizado
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {grupos.length === 0 && (
          <p className="py-4 text-center text-sm text-text-muted">Nenhum lançamento ainda.</p>
        )}
      </div>

      {open && (
        <NovoLancamentoModal
          fornecedores={fornecedores}
          onClose={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

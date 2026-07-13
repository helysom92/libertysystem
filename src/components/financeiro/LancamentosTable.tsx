"use client";

import { useState } from "react";
import type { Lancamento } from "@/lib/domain/types";
import { fmtBRL } from "@/lib/domain/types";
import NovoLancamentoModal from "./NovoLancamentoModal";

export default function LancamentosTable({ lancamentos }: { lancamentos: Lancamento[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-card border border-border-neutral bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-sm font-bold">Lançamentos</h3>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-3 py-1.5 text-[12.5px] font-semibold text-bg"
        >
          + Novo Lançamento
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[12.5px]">
          <thead>
            <tr className="text-[10.5px] tracking-wide text-text-muted uppercase">
              <th className="pb-2">Descrição</th>
              <th className="pb-2">Categoria</th>
              <th className="pb-2">Data</th>
              <th className="pb-2">Valor</th>
              <th className="pb-2">Tipo</th>
            </tr>
          </thead>
          <tbody>
            {lancamentos.map((l) => (
              <tr key={l.id} className="border-t border-border-neutral">
                <td className="py-2 font-medium">{l.descricao}</td>
                <td className="py-2 text-text-secondary">{l.categoria}</td>
                <td className="py-2 text-text-secondary">
                  {new Date(l.data + "T00:00:00").toLocaleDateString("pt-BR")}
                </td>
                <td className={`py-2 font-semibold ${l.tipo === "Despesa" ? "text-danger" : "text-success"}`}>
                  {l.tipo === "Despesa" ? "- " : ""}
                  {fmtBRL(l.valor)}
                </td>
                <td className="py-2">
                  <span
                    className="rounded-pill px-2 py-0.5 text-[10.5px]"
                    style={{
                      color: l.tipo === "Despesa" ? "#E07A7A" : "#25D366",
                      border: "1px solid currentColor",
                    }}
                  >
                    {l.tipo}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {lancamentos.length === 0 && (
          <p className="py-4 text-center text-sm text-text-muted">Nenhum lançamento ainda.</p>
        )}
      </div>

      {open && <NovoLancamentoModal onClose={() => setOpen(false)} />}
    </div>
  );
}

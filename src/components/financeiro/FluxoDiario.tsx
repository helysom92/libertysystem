"use client";

import type { Fornecedor, Lancamento } from "@/lib/domain/types";
import LancamentosLista from "./LancamentosLista";

export default function FluxoDiario({
  lancamentos,
  fornecedores,
}: {
  lancamentos: Lancamento[];
  fornecedores: Fornecedor[];
}) {
  return (
    <div className="rounded-card border border-border-neutral bg-card p-4">
      <div className="mb-3">
        <h3 className="font-display text-sm font-bold">Fluxo Financeiro</h3>
        <p className="text-[11.5px] text-text-muted">
          Receitas vêm das OS, despesas vêm da aba Despesas — aqui é só acompanhar e editar
        </p>
      </div>

      <LancamentosLista lancamentos={lancamentos} fornecedores={fornecedores} />
    </div>
  );
}

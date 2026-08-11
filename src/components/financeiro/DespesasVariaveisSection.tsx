"use client";

import { useState, useTransition } from "react";
import type { DespesaVariavel, DespesaVariavelOcorrencia, Fornecedor } from "@/lib/domain/types";
import { fmtBRL } from "@/lib/domain/types";
import { toggleDespesaVariavelPago, updateDespesaVariavelValor } from "@/lib/actions/financeiro";
import NovaDespesaVariavelModal from "./NovaDespesaVariavelModal";

function LinhaDespesaVariavel({
  despesa,
  ocorrencia,
  ano,
  mes,
}: {
  despesa: DespesaVariavel;
  ocorrencia: DespesaVariavelOcorrencia | undefined;
  ano: number;
  mes: number;
}) {
  const valorInicial = ocorrencia?.valor_real ?? despesa.valor_provisionado;
  const [valor, setValor] = useState(String(valorInicial));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const dirty = Number(valor) !== valorInicial;

  function salvar() {
    setError(null);
    startTransition(async () => {
      try {
        await updateDespesaVariavelValor(despesa.id, ano, mes, Number(valor) || 0);
      } catch (err) {
        console.error("Falha ao salvar despesa variável", err);
        setError(err instanceof Error ? err.message : "Não foi possível salvar esse valor.");
      }
    });
  }

  function togglePago(checked: boolean) {
    setError(null);
    startTransition(async () => {
      try {
        await toggleDespesaVariavelPago(despesa.id, ano, mes, checked);
      } catch (err) {
        console.error("Falha ao atualizar despesa variável", err);
        setError(err instanceof Error ? err.message : "Não foi possível atualizar essa despesa.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-btn bg-card-secondary px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">{despesa.descricao}</p>
          <p className="text-[11.5px] text-text-muted">
            {despesa.categoria} · provisionado {fmtBRL(despesa.valor_provisionado)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="0.01"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="w-28 rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
          />
          {dirty && (
            <button
              type="button"
              onClick={salvar}
              disabled={pending}
              className="rounded-btn bg-gold px-2.5 py-1.5 text-[11.5px] font-semibold text-bg disabled:opacity-60"
            >
              Salvar
            </button>
          )}
          <label className="flex items-center gap-1.5 text-[12px]">
            <input
              type="checkbox"
              checked={ocorrencia?.pago ?? false}
              onChange={(e) => togglePago(e.target.checked)}
            />
            Pago
          </label>
        </div>
      </div>
      {error && <p className="text-[11px] text-danger">{error}</p>}
    </div>
  );
}

export default function DespesasVariaveisSection({
  despesas,
  ocorrencias,
  fornecedores,
  ano,
  mes,
}: {
  despesas: DespesaVariavel[];
  ocorrencias: DespesaVariavelOcorrencia[];
  fornecedores: Fornecedor[];
  ano: number;
  mes: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-card border border-border-neutral bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="font-display text-sm font-bold">Despesas Variáveis</h3>
          <p className="text-[12px] text-text-secondary">
            Provisionadas — edite o valor real quando a conta chegar
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-btn border border-border-gold-strong px-3 py-1.5 text-[12.5px] text-gold"
        >
          + Nova Despesa Variável
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {despesas.map((d) => (
          <LinhaDespesaVariavel
            key={d.id}
            despesa={d}
            ocorrencia={ocorrencias.find((o) => o.despesa_variavel_id === d.id)}
            ano={ano}
            mes={mes}
          />
        ))}
        {despesas.length === 0 && (
          <p className="text-sm text-text-muted">Nenhuma despesa variável cadastrada.</p>
        )}
      </div>

      {open && <NovaDespesaVariavelModal fornecedores={fornecedores} onClose={() => setOpen(false)} />}
    </div>
  );
}

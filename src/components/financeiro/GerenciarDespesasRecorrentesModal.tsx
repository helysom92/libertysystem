"use client";

import type {
  DespesaFixa,
  DespesaFixaOcorrencia,
  DespesaVariavel,
  DespesaVariavelOcorrencia,
  Fornecedor,
} from "@/lib/domain/types";
import DespesasFixasSection from "./DespesasFixasSection";
import DespesasVariaveisSection from "./DespesasVariaveisSection";

/** As caixinhas de "marcar como pago" mês a mês pras despesas recorrentes (fixas e
 * variáveis) — fica escondido atrás dessa engrenagem, longe do histórico principal. */
export default function GerenciarDespesasRecorrentesModal({
  despesasFixas,
  ocorrenciasFixas,
  despesasVariaveis,
  ocorrenciasVariaveis,
  fornecedores,
  ano,
  mes,
  onClose,
}: {
  despesasFixas: DespesaFixa[];
  ocorrenciasFixas: DespesaFixaOcorrencia[];
  despesasVariaveis: DespesaVariavel[];
  ocorrenciasVariaveis: DespesaVariavelOcorrencia[];
  fornecedores: Fornecedor[];
  ano: number;
  mes: number;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-2xl flex-col rounded-card border border-border-gold bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border-neutral px-6 py-4">
          <div>
            <h2 className="font-display text-lg font-bold">Despesas Recorrentes</h2>
            <p className="text-[12px] text-text-secondary">
              Cadastre uma vez e marque como pago todo mês — cada vez que marcar, entra em Lançamentos
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-btn px-3 py-1 text-text-secondary hover:text-text">
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-4">
            <DespesasFixasSection
              despesas={despesasFixas}
              ocorrencias={ocorrenciasFixas}
              fornecedores={fornecedores}
              ano={ano}
              mes={mes}
            />
          </div>
          <DespesasVariaveisSection
            despesas={despesasVariaveis}
            ocorrencias={ocorrenciasVariaveis}
            fornecedores={fornecedores}
            ano={ano}
            mes={mes}
          />
        </div>
      </div>
    </div>
  );
}

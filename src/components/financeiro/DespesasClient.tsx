"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  DespesaFixa,
  DespesaFixaOcorrencia,
  DespesaVariavel,
  DespesaVariavelOcorrencia,
  Fornecedor,
  Lancamento,
  LancamentoAtalho,
} from "@/lib/domain/types";
import AtalhosLancamento from "./AtalhosLancamento";
import LancamentosLista from "./LancamentosLista";
import NovaDespesaModal from "./NovaDespesaModal";
import GerenciarDespesasRecorrentesModal from "./GerenciarDespesasRecorrentesModal";

export default function DespesasClient({
  despesasFixas,
  ocorrenciasFixas,
  despesasVariaveis,
  ocorrenciasVariaveis,
  fornecedores,
  atalhos,
  lancamentos,
  ano,
  mes,
  abrirRecorrentes = false,
  secaoInicial = "fixas",
}: {
  despesasFixas: DespesaFixa[];
  ocorrenciasFixas: DespesaFixaOcorrencia[];
  despesasVariaveis: DespesaVariavel[];
  ocorrenciasVariaveis: DespesaVariavelOcorrencia[];
  fornecedores: Fornecedor[];
  atalhos: LancamentoAtalho[];
  lancamentos: Lancamento[];
  ano: number;
  mes: number;
  abrirRecorrentes?: boolean;
  secaoInicial?: "fixas" | "variaveis";
}) {
  const router = useRouter();
  const [novaOpen, setNovaOpen] = useState(false);
  const [gerenciarOpen, setGerenciarOpen] = useState(abrirRecorrentes);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Despesas</h1>
          <p className="text-[13px] text-text-secondary">Lance e marque como pagas</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setNovaOpen(true)}
            className="rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-3 py-1.5 text-[12.5px] font-semibold text-bg"
          >
            + Nova Despesa
          </button>
          <button
            type="button"
            onClick={() => setGerenciarOpen(true)}
            className="rounded-btn border border-border-neutral px-3 py-1.5 text-[12.5px] text-text-secondary hover:text-text"
            title="Gerenciar despesas recorrentes"
          >
            ⚙️ Despesas recorrentes
          </button>
        </div>
      </div>

      <AtalhosLancamento atalhos={atalhos} fornecedores={fornecedores} />

      <div className="rounded-card border border-border-neutral bg-card p-4">
        <h3 className="mb-3 font-display text-sm font-bold">Histórico de Despesas</h3>
        <LancamentosLista
          lancamentos={lancamentos}
          fornecedores={fornecedores}
          vazioLabel="Nenhuma despesa lançada ainda."
        />
      </div>

      {novaOpen && (
        <NovaDespesaModal
          fornecedores={fornecedores}
          despesasFixas={despesasFixas}
          despesasVariaveis={despesasVariaveis}
          onClose={() => {
            setNovaOpen(false);
            router.refresh();
          }}
        />
      )}
      {gerenciarOpen && (
        <GerenciarDespesasRecorrentesModal
          despesasFixas={despesasFixas}
          ocorrenciasFixas={ocorrenciasFixas}
          despesasVariaveis={despesasVariaveis}
          ocorrenciasVariaveis={ocorrenciasVariaveis}
          fornecedores={fornecedores}
          ano={ano}
          mes={mes}
          secaoInicial={secaoInicial}
          onClose={() => {
            setGerenciarOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

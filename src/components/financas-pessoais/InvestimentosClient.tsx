"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ContaPessoal, InvestimentoPessoal, MovimentoInvestimentoPessoal } from "@/lib/domain/types";
import { fmtBRL } from "@/lib/domain/types";
import {
  saldoInvestimento,
  totalAportadoInvestimento,
  rendimentoTotalInvestimento,
  totalInvestidoGeral,
} from "@/lib/domain/financasPessoais";
import { arquivarInvestimento, estornarMovimentoInvestimento, listarMovimentosDoInvestimento } from "@/lib/actions/financasPessoais";
import NovoInvestimentoModal from "./NovoInvestimentoModal";
import MovimentoInvestimentoModal from "./MovimentoInvestimentoModal";
import HistoricoPessoalModal from "./HistoricoPessoalModal";

export default function InvestimentosClient({
  contas,
  investimentos,
  movimentos,
}: {
  contas: ContaPessoal[];
  investimentos: InvestimentoPessoal[];
  movimentos: MovimentoInvestimentoPessoal[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [novoOpen, setNovoOpen] = useState(false);
  const [editando, setEditando] = useState<InvestimentoPessoal | null>(null);
  const [movimentando, setMovimentando] = useState<InvestimentoPessoal | null>(null);
  const [historico, setHistorico] = useState<InvestimentoPessoal | null>(null);

  function acao(fn: () => Promise<{ ok: boolean; message?: string }>) {
    startTransition(async () => {
      const resultado = await fn();
      if (!resultado.ok) {
        setError(resultado.message ?? "Não foi possível concluir essa ação.");
        return;
      }
      router.refresh();
    });
  }

  const ativos = investimentos.filter((i) => i.ativo);
  const arquivados = investimentos.filter((i) => !i.ativo);
  const totalGeral = totalInvestidoGeral(investimentos, movimentos);

  return (
    <div>
      {error && (
        <p className="mb-3 rounded-btn border border-danger-border bg-card px-3 py-2 text-[12.5px] text-danger">{error}</p>
      )}
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Investimentos</h1>
          <p className="text-[13px] text-text-secondary">
            Total investido: <span className="font-semibold text-text">{fmtBRL(totalGeral)}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setNovoOpen(true)}
          className="shrink-0 rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-4 py-2 text-sm font-semibold text-bg"
        >
          + Novo Investimento
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {ativos.map((i) => {
          const saldo = saldoInvestimento(i, movimentos);
          const aportado = totalAportadoInvestimento(i, movimentos);
          const rendimento = rendimentoTotalInvestimento(i, movimentos);
          return (
            <div key={i.id} className="rounded-card border border-border-neutral bg-card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-text">{i.nome}</p>
                  <p className="text-[12px] text-text-secondary">
                    {i.tipo || "—"} {i.instituicao ? `· ${i.instituicao}` : ""}
                  </p>
                </div>
                <p className="text-[15px] font-semibold text-text">{fmtBRL(saldo)}</p>
              </div>
              <div className="mt-2 text-[12px] text-text-secondary">
                <p>Aportado: {fmtBRL(aportado)}</p>
                {rendimento > 0 && <p className="text-success">Rendimento acumulado: {fmtBRL(rendimento)}</p>}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11.5px]">
                <button type="button" onClick={() => setMovimentando(i)} className="text-gold hover:underline">
                  Registrar movimento
                </button>
                <button type="button" onClick={() => setHistorico(i)} className="text-text-secondary hover:underline">
                  Histórico
                </button>
                <button type="button" onClick={() => setEditando(i)} className="text-text-secondary hover:underline">
                  Editar
                </button>
                <button type="button" onClick={() => acao(() => arquivarInvestimento(i.id, false))} className="text-text-muted hover:underline">
                  Desativar
                </button>
              </div>
            </div>
          );
        })}
        {ativos.length === 0 && (
          <p className="col-span-2 rounded-card border border-border-neutral bg-card p-6 text-center text-text-muted">
            Nenhum investimento cadastrado ainda.
          </p>
        )}
      </div>

      {arquivados.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 text-[13px] font-semibold text-text-secondary">Desativados</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {arquivados.map((i) => (
              <div key={i.id} className="rounded-card border border-border-neutral bg-card p-4">
                <p className="font-semibold text-text">{i.nome}</p>
                <p className="text-[12px] text-text-secondary">{fmtBRL(saldoInvestimento(i, movimentos))}</p>
                <button
                  type="button"
                  onClick={() => acao(() => arquivarInvestimento(i.id, true))}
                  className="mt-2 text-[11.5px] text-gold hover:underline"
                >
                  Reativar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {novoOpen && (
        <NovoInvestimentoModal
          onClose={() => {
            setNovoOpen(false);
            router.refresh();
          }}
        />
      )}
      {editando && (
        <NovoInvestimentoModal
          investimento={editando}
          onClose={() => {
            setEditando(null);
            router.refresh();
          }}
        />
      )}
      {movimentando && (
        <MovimentoInvestimentoModal
          investimento={movimentando}
          saldoAtual={saldoInvestimento(movimentando, movimentos)}
          contas={contas}
          onClose={() => {
            setMovimentando(null);
            router.refresh();
          }}
        />
      )}
      {historico && (
        <HistoricoPessoalModal
          titulo={`Histórico — ${historico.nome}`}
          carregar={() => listarMovimentosDoInvestimento(historico.id)}
          onEstornar={async (id, motivo) => {
            const resultado = await estornarMovimentoInvestimento(id, motivo);
            if (resultado.ok) router.refresh();
            return resultado;
          }}
          onFechar={() => {
            setHistorico(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

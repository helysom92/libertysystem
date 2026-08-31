"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ContaPessoal, OrigemReceitaPessoal, ReceitaPessoal, DespesaPessoal } from "@/lib/domain/types";
import { fmtBRL } from "@/lib/domain/types";
import { fmtDatePtBR, hojeISOOperacao } from "@/lib/domain/dates";
import { situacaoObrigacaoPessoal, type SituacaoObrigacaoPessoal } from "@/lib/domain/financasPessoais";
import {
  registrarRecebimento,
  listarRecebimentosDaReceita,
  estornarRecebimento,
  cancelarReceita,
  deleteReceita,
  duplicarReceitaProximoPeriodo,
  registrarPagamento,
  listarPagamentosDaDespesa,
  estornarPagamento,
  cancelarDespesa,
  deleteDespesa,
  duplicarDespesaProximoPeriodo,
} from "@/lib/actions/financasPessoais";
import NovaReceitaModal from "./NovaReceitaModal";
import NovaDespesaModal from "./NovaDespesaModal";
import RegistrarValorModal from "./RegistrarValorModal";
import HistoricoPessoalModal from "./HistoricoPessoalModal";

const SITUACAO_LABEL: Record<SituacaoObrigacaoPessoal, string> = {
  prevista: "Prevista",
  parcial: "Parcial",
  quitada: "Quitada",
  a_vencer: "A vencer",
  vencida: "Vencida",
  cancelada: "Cancelada",
};

const SITUACAO_COLOR: Record<SituacaoObrigacaoPessoal, string> = {
  prevista: "text-text-secondary",
  parcial: "text-gold",
  quitada: "text-success",
  a_vencer: "text-text-secondary",
  vencida: "text-danger",
  cancelada: "text-text-muted",
};

export default function ReceitasDespesasClient({
  contas,
  origens,
  receitasIniciais,
  despesasIniciais,
}: {
  contas: ContaPessoal[];
  origens: OrigemReceitaPessoal[];
  receitasIniciais: ReceitaPessoal[];
  despesasIniciais: DespesaPessoal[];
}) {
  const router = useRouter();
  const hoje = hojeISOOperacao();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [novaReceitaOpen, setNovaReceitaOpen] = useState(false);
  const [editandoReceita, setEditandoReceita] = useState<ReceitaPessoal | null>(null);
  const [registrandoReceita, setRegistrandoReceita] = useState<ReceitaPessoal | null>(null);
  const [historicoReceita, setHistoricoReceita] = useState<ReceitaPessoal | null>(null);

  const [novaDespesaOpen, setNovaDespesaOpen] = useState(false);
  const [editandoDespesa, setEditandoDespesa] = useState<DespesaPessoal | null>(null);
  const [registrandoDespesa, setRegistrandoDespesa] = useState<DespesaPessoal | null>(null);
  const [historicoDespesa, setHistoricoDespesa] = useState<DespesaPessoal | null>(null);

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

  return (
    <div>
      {error && (
        <p className="mb-3 rounded-btn border border-danger-border bg-card px-3 py-2 text-[12.5px] text-danger">{error}</p>
      )}

      {/* ── Receitas ── */}
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="font-display text-lg font-bold">Receitas</h1>
          <button
            type="button"
            onClick={() => setNovaReceitaOpen(true)}
            className="rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-4 py-2 text-sm font-semibold text-bg"
          >
            + Nova Receita
          </button>
        </div>
        <div className="overflow-x-auto rounded-card border border-border-neutral">
          <table className="w-full text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-border-neutral text-[10.5px] tracking-wide text-text-muted uppercase">
                <th className="px-3 py-2">Descrição</th>
                <th className="px-3 py-2">Previsto</th>
                <th className="px-3 py-2">Recebido</th>
                <th className="px-3 py-2">Data prevista</th>
                <th className="px-3 py-2">Situação</th>
                <th className="px-3 py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {receitasIniciais.map((r) => {
                const situacao = situacaoObrigacaoPessoal(r.situacao, r.data_prevista, hoje);
                const saldo = Math.max(0, r.valor_previsto - r.valor_recebido);
                return (
                  <tr key={r.id} className="border-b border-border-neutral bg-card align-top">
                    <td className="px-3 py-2">
                      <p className="font-semibold text-text">{r.descricao}</p>
                      {r.categoria && <p className="text-text-muted">{r.categoria}</p>}
                    </td>
                    <td className="px-3 py-2">{fmtBRL(r.valor_previsto)}</td>
                    <td className="px-3 py-2">{fmtBRL(r.valor_recebido)}</td>
                    <td className="px-3 py-2">{r.data_prevista ? fmtDatePtBR(r.data_prevista) : "—"}</td>
                    <td className={`px-3 py-2 font-semibold ${SITUACAO_COLOR[situacao]}`}>{SITUACAO_LABEL[situacao]}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        {saldo > 0 && situacao !== "cancelada" && (
                          <button type="button" onClick={() => setRegistrandoReceita(r)} className="text-gold hover:underline">
                            Registrar
                          </button>
                        )}
                        <button type="button" onClick={() => setHistoricoReceita(r)} className="text-text-secondary hover:underline">
                          Histórico
                        </button>
                        <button type="button" onClick={() => setEditandoReceita(r)} className="text-text-secondary hover:underline">
                          Editar
                        </button>
                        {r.recorrencia !== "unica" && (
                          <button
                            type="button"
                            onClick={() => acao(() => duplicarReceitaProximoPeriodo(r.id))}
                            className="text-text-secondary hover:underline"
                          >
                            Duplicar
                          </button>
                        )}
                        {situacao !== "cancelada" && (
                          <button
                            type="button"
                            onClick={() =>
                              acao(() => {
                                const motivo = window.prompt("Motivo do cancelamento (opcional):") ?? "";
                                return cancelarReceita(r.id, motivo || null);
                              })
                            }
                            className="text-text-muted hover:underline"
                          >
                            Cancelar
                          </button>
                        )}
                        {r.valor_recebido === 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm("Excluir esta receita definitivamente?")) acao(() => deleteReceita(r.id));
                            }}
                            className="text-danger hover:underline"
                          >
                            Excluir
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {receitasIniciais.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-text-muted">
                    Nenhuma receita cadastrada ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Despesas ── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h1 className="font-display text-lg font-bold">Despesas</h1>
          <button
            type="button"
            onClick={() => setNovaDespesaOpen(true)}
            className="rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-4 py-2 text-sm font-semibold text-bg"
          >
            + Nova Despesa
          </button>
        </div>
        <div className="overflow-x-auto rounded-card border border-border-neutral">
          <table className="w-full text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-border-neutral text-[10.5px] tracking-wide text-text-muted uppercase">
                <th className="px-3 py-2">Descrição</th>
                <th className="px-3 py-2">Previsto</th>
                <th className="px-3 py-2">Pago</th>
                <th className="px-3 py-2">Vencimento</th>
                <th className="px-3 py-2">Situação</th>
                <th className="px-3 py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {despesasIniciais.map((d) => {
                const situacao = situacaoObrigacaoPessoal(d.situacao, d.vencimento, hoje);
                const saldo = Math.max(0, d.valor_previsto - d.valor_pago);
                return (
                  <tr key={d.id} className="border-b border-border-neutral bg-card align-top">
                    <td className="px-3 py-2">
                      <p className="font-semibold text-text">{d.descricao}</p>
                      {d.categoria && <p className="text-text-muted">{d.categoria}</p>}
                    </td>
                    <td className="px-3 py-2">{fmtBRL(d.valor_previsto)}</td>
                    <td className="px-3 py-2">{fmtBRL(d.valor_pago)}</td>
                    <td className="px-3 py-2">{d.vencimento ? fmtDatePtBR(d.vencimento) : "—"}</td>
                    <td className={`px-3 py-2 font-semibold ${SITUACAO_COLOR[situacao]}`}>{SITUACAO_LABEL[situacao]}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        {saldo > 0 && situacao !== "cancelada" && (
                          <button type="button" onClick={() => setRegistrandoDespesa(d)} className="text-gold hover:underline">
                            Registrar
                          </button>
                        )}
                        <button type="button" onClick={() => setHistoricoDespesa(d)} className="text-text-secondary hover:underline">
                          Histórico
                        </button>
                        <button type="button" onClick={() => setEditandoDespesa(d)} className="text-text-secondary hover:underline">
                          Editar
                        </button>
                        {d.recorrencia !== "unica" && (
                          <button
                            type="button"
                            onClick={() => acao(() => duplicarDespesaProximoPeriodo(d.id))}
                            className="text-text-secondary hover:underline"
                          >
                            Duplicar
                          </button>
                        )}
                        {situacao !== "cancelada" && (
                          <button
                            type="button"
                            onClick={() =>
                              acao(() => {
                                const motivo = window.prompt("Motivo do cancelamento (opcional):") ?? "";
                                return cancelarDespesa(d.id, motivo || null);
                              })
                            }
                            className="text-text-muted hover:underline"
                          >
                            Cancelar
                          </button>
                        )}
                        {d.valor_pago === 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm("Excluir esta despesa definitivamente?")) acao(() => deleteDespesa(d.id));
                            }}
                            className="text-danger hover:underline"
                          >
                            Excluir
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {despesasIniciais.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-text-muted">
                    Nenhuma despesa cadastrada ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {novaReceitaOpen && (
        <NovaReceitaModal
          contas={contas}
          origens={origens}
          onClose={() => {
            setNovaReceitaOpen(false);
            router.refresh();
          }}
        />
      )}
      {editandoReceita && (
        <NovaReceitaModal
          contas={contas}
          origens={origens}
          receita={editandoReceita}
          onClose={() => {
            setEditandoReceita(null);
            router.refresh();
          }}
        />
      )}
      {registrandoReceita && (
        <RegistrarValorModal
          titulo="Registrar recebimento"
          saldoAberto={Math.max(0, registrandoReceita.valor_previsto - registrandoReceita.valor_recebido)}
          contas={contas}
          contaLabel="Conta de destino"
          onConfirm={(valor, data, contaId) => registrarRecebimento(registrandoReceita.id, { valor, data, contaDestinoId: contaId })}
          onClose={() => {
            setRegistrandoReceita(null);
            router.refresh();
          }}
        />
      )}
      {historicoReceita && (
        <HistoricoPessoalModal
          titulo={`Histórico de recebimentos — ${historicoReceita.descricao}`}
          carregar={() => listarRecebimentosDaReceita(historicoReceita.id)}
          onEstornar={async (id, motivo) => {
            const resultado = await estornarRecebimento(id, motivo);
            if (resultado.ok) router.refresh();
            return resultado;
          }}
          onFechar={() => {
            setHistoricoReceita(null);
            router.refresh();
          }}
        />
      )}

      {novaDespesaOpen && (
        <NovaDespesaModal
          contas={contas}
          onClose={() => {
            setNovaDespesaOpen(false);
            router.refresh();
          }}
        />
      )}
      {editandoDespesa && (
        <NovaDespesaModal
          contas={contas}
          despesa={editandoDespesa}
          onClose={() => {
            setEditandoDespesa(null);
            router.refresh();
          }}
        />
      )}
      {registrandoDespesa && (
        <RegistrarValorModal
          titulo="Registrar pagamento"
          saldoAberto={Math.max(0, registrandoDespesa.valor_previsto - registrandoDespesa.valor_pago)}
          contas={contas}
          contaLabel="Conta usada"
          onConfirm={(valor, data, contaId) => registrarPagamento(registrandoDespesa.id, { valor, data, contaId })}
          onClose={() => {
            setRegistrandoDespesa(null);
            router.refresh();
          }}
        />
      )}
      {historicoDespesa && (
        <HistoricoPessoalModal
          titulo={`Histórico de pagamentos — ${historicoDespesa.descricao}`}
          carregar={() => listarPagamentosDaDespesa(historicoDespesa.id)}
          onEstornar={async (id, motivo) => {
            const resultado = await estornarPagamento(id, motivo);
            if (resultado.ok) router.refresh();
            return resultado;
          }}
          onFechar={() => {
            setHistoricoDespesa(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

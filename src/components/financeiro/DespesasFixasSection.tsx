"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DespesaFixa, DespesaFixaOcorrencia, DespesaOcorrenciaPagamento, Fornecedor } from "@/lib/domain/types";
import { fmtBRL } from "@/lib/domain/types";
import { fmtDatePtBR, hojeISOOperacao, todayISO } from "@/lib/domain/dates";
import {
  cancelarOcorrenciaDespesaFixa,
  estornarPagamentoDespesaOcorrencia,
  listarPagamentosDespesaOcorrencia,
  registrarPagamentoDespesaFixaOcorrencia,
} from "@/lib/actions/financeiro";
import NovaDespesaFixaModal from "./NovaDespesaFixaModal";

function saldoDaOcorrencia(despesa: DespesaFixa, ocorrencia: DespesaFixaOcorrencia | undefined): number {
  const pago = ocorrencia?.valor_pago ?? 0;
  return Math.max(0, despesa.valor - pago);
}

/** Vencimento como data completa (ano/mes já vêm do mês selecionado, não "hoje") — antes essa
 * função só comparava o dia do mês, ignorando ano/mês, divergindo do critério usado no resto
 * do app (`dashboardMetrics.ts`). */
function computeStatus(despesa: DespesaFixa, ocorrencia: DespesaFixaOcorrencia | undefined, ano: number, mes: number) {
  if (ocorrencia?.cancelada_em) return "Cancelada";
  if (saldoDaOcorrencia(despesa, ocorrencia) <= 0 && (ocorrencia?.valor_pago ?? 0) > 0) return "Pago";
  if ((ocorrencia?.valor_pago ?? 0) > 0) return "Parcial";
  const vencimento = `${ano}-${String(mes).padStart(2, "0")}-${String(despesa.dia_vencimento).padStart(2, "0")}`;
  return vencimento < hojeISOOperacao() ? "Vencido" : "A Pagar";
}

const STATUS_COLOR: Record<string, string> = {
  Pago: "#25D366",
  Parcial: "#E0A64E",
  "A Pagar": "rgba(244,242,236,0.6)",
  Vencido: "#E07A7A",
  Cancelada: "#8a8378",
};

export default function DespesasFixasSection({
  despesas,
  ocorrencias,
  fornecedores,
  ano,
  mes,
}: {
  despesas: DespesaFixa[];
  ocorrencias: DespesaFixaOcorrencia[];
  fornecedores: Fornecedor[];
  ano: number;
  mes: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DespesaFixa | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [payingId, setPayingId] = useState<string | null>(null);
  const [payValor, setPayValor] = useState("");
  const [payData, setPayData] = useState(todayISO());
  const [payingSaving, setPayingSaving] = useState(false);

  const [historicoFor, setHistoricoFor] = useState<string | null>(null);
  const [historicoData, setHistoricoData] = useState<DespesaOcorrenciaPagamento[]>([]);
  const [historicoLoading, setHistoricoLoading] = useState(false);
  const [estornandoId, setEstornandoId] = useState<string | null>(null);

  function startPay(d: DespesaFixa, ocorrencia: DespesaFixaOcorrencia | undefined) {
    setPayingId(d.id);
    setPayValor(String(saldoDaOcorrencia(d, ocorrencia)));
    setPayData(todayISO());
    setError(null);
  }

  async function confirmPay(d: DespesaFixa, ocorrencia: DespesaFixaOcorrencia | undefined) {
    const valor = Number(payValor) || 0;
    const saldo = saldoDaOcorrencia(d, ocorrencia);
    if (valor > saldo) {
      setError(`O valor informado (${fmtBRL(valor)}) é maior que o saldo em aberto (${fmtBRL(saldo)}). Ajuste antes de confirmar.`);
      return;
    }
    setPayingSaving(true);
    setError(null);
    const resultado = await registrarPagamentoDespesaFixaOcorrencia(d.id, ano, mes, valor, payData);
    if (!resultado.ok) {
      setError(resultado.message);
    } else {
      setPayingId(null);
      router.refresh();
    }
    setPayingSaving(false);
  }

  async function handleCancelar(despesaFixaId: string) {
    const motivo = prompt("Motivo do cancelamento desse mês (opcional):");
    if (motivo === null) return;
    const resultado = await cancelarOcorrenciaDespesaFixa(despesaFixaId, ano, mes, motivo || null);
    if (!resultado.ok) {
      setError(resultado.message);
    } else {
      router.refresh();
    }
  }

  async function toggleHistorico(ocorrencia: DespesaFixaOcorrencia | undefined) {
    if (!ocorrencia) return;
    if (historicoFor === ocorrencia.id) {
      setHistoricoFor(null);
      return;
    }
    setHistoricoFor(ocorrencia.id);
    setHistoricoLoading(true);
    try {
      const pagamentos = await listarPagamentosDespesaOcorrencia("despesa_fixa_ocorrencia", ocorrencia.id);
      setHistoricoData(pagamentos as DespesaOcorrenciaPagamento[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar o histórico.");
    } finally {
      setHistoricoLoading(false);
    }
  }

  async function handleEstornarPagamento(pagamentoId: string) {
    const motivo = prompt("Motivo do estorno (opcional):");
    if (motivo === null) return;
    setEstornandoId(pagamentoId);
    const resultado = await estornarPagamentoDespesaOcorrencia("despesa_fixa_ocorrencia", pagamentoId, motivo || null);
    if (!resultado.ok) {
      alert(resultado.message);
    } else {
      if (historicoFor) {
        try {
          const pagamentos = await listarPagamentosDespesaOcorrencia("despesa_fixa_ocorrencia", historicoFor);
          setHistoricoData(pagamentos as DespesaOcorrenciaPagamento[]);
        } catch {
          // estorno já confirmado — só a lista aberta não recarregou.
        }
      }
      router.refresh();
    }
    setEstornandoId(null);
  }

  return (
    <div className="rounded-card border border-border-neutral bg-card p-4">
      {error && (
        <p className="mb-3 rounded-btn border border-danger-border bg-card-secondary px-3 py-2 text-[12.5px] text-danger">
          {error}
        </p>
      )}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-sm font-bold">Despesas Fixas</h3>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-btn border border-border-gold-strong px-3 py-1.5 text-[12.5px] text-gold"
        >
          + Nova Despesa Fixa
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {despesas.map((d) => {
          const ocorrencia = ocorrencias.find((o) => o.despesa_fixa_id === d.id);
          const status = computeStatus(d, ocorrencia, ano, mes);
          return (
            <div key={d.id} className="rounded-btn bg-card-secondary px-3 py-2 text-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <button type="button" onClick={() => setEditing(d)} className="text-left hover:underline">
                  <p className="font-medium">{d.descricao}</p>
                  <p className="text-[11.5px] text-text-muted">
                    {d.categoria} · vence dia {d.dia_vencimento} · {fmtBRL(d.valor)}
                    {status === "Parcial" && ` · pago ${fmtBRL(ocorrencia?.valor_pago ?? 0)} · saldo ${fmtBRL(saldoDaOcorrencia(d, ocorrencia))}`}
                  </p>
                </button>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-pill px-2 py-0.5 text-[10.5px] font-semibold" style={{ color: STATUS_COLOR[status] }}>
                    {status}
                  </span>
                  {(status === "A Pagar" || status === "Vencido" || status === "Parcial") && payingId !== d.id && (
                    <button type="button" onClick={() => startPay(d, ocorrencia)} className="text-[11px] text-gold">
                      {status === "Parcial" ? "Quitar / pagar mais" : "Registrar pagamento"}
                    </button>
                  )}
                  {(status === "Pago" || status === "Parcial") && (
                    <button type="button" onClick={() => toggleHistorico(ocorrencia)} className="text-[11px] text-text-secondary hover:text-text">
                      {historicoFor === ocorrencia?.id ? "Fechar histórico" : "Histórico / Estornar"}
                    </button>
                  )}
                  {(status === "A Pagar" || status === "Vencido") && (
                    <button type="button" onClick={() => handleCancelar(d.id)} className="text-[11px] text-danger">
                      Cancelar mês
                    </button>
                  )}
                </div>
              </div>

              {payingId === d.id && (
                <div className="mt-2 flex flex-wrap items-end gap-2 rounded-btn border border-border-neutral bg-card p-2.5">
                  <div>
                    <label className="mb-1 block text-[11px] text-text-secondary">Valor a pagar agora</label>
                    <input
                      type="number"
                      step="0.01"
                      value={payValor}
                      onChange={(e) => setPayValor(e.target.value)}
                      className="w-32 rounded-btn border border-border-neutral bg-card-secondary px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-text-secondary">Data</label>
                    <input
                      type="date"
                      value={payData}
                      onChange={(e) => setPayData(e.target.value)}
                      className="w-36 rounded-btn border border-border-neutral bg-card-secondary px-2 py-1.5 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => confirmPay(d, ocorrencia)}
                    disabled={payingSaving}
                    className="rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-3 py-1.5 text-[12.5px] font-semibold text-bg disabled:opacity-40"
                  >
                    {payingSaving ? "Confirmando..." : "Confirmar pagamento"}
                  </button>
                  <button type="button" onClick={() => setPayingId(null)} className="rounded-btn px-3 py-1.5 text-[12.5px] text-text-secondary">
                    Cancelar
                  </button>
                </div>
              )}

              {historicoFor === ocorrencia?.id && (
                <div className="mt-2 flex flex-col gap-1.5 rounded-btn border border-border-neutral bg-card p-2.5">
                  <p className="text-[10.5px] tracking-wide text-text-muted uppercase">Pagamentos desta ocorrência</p>
                  {historicoLoading && <p className="text-[11.5px] text-text-muted">Carregando...</p>}
                  {!historicoLoading &&
                    historicoData.map((pg) => (
                      <div key={pg.id} className="flex items-center justify-between gap-2 rounded-btn bg-card-secondary px-2.5 py-1.5">
                        <div>
                          <p className={pg.estornado_em ? "text-text-muted line-through" : ""}>
                            {fmtBRL(pg.valor)} · {fmtDatePtBR(pg.data)}
                          </p>
                          {pg.estornado_em && (
                            <p className="text-[11px] text-text-muted">
                              Estornado em {fmtDatePtBR(pg.estornado_em.slice(0, 10))}
                              {pg.motivo_estorno && ` — ${pg.motivo_estorno}`}
                            </p>
                          )}
                        </div>
                        {!pg.estornado_em && (
                          <button
                            type="button"
                            disabled={estornandoId === pg.id}
                            onClick={() => handleEstornarPagamento(pg.id)}
                            className="text-[11px] text-danger disabled:opacity-40"
                          >
                            {estornandoId === pg.id ? "Estornando..." : "Estornar"}
                          </button>
                        )}
                      </div>
                    ))}
                  {!historicoLoading && historicoData.length === 0 && (
                    <p className="text-[11.5px] text-text-muted">Nenhum pagamento registrado ainda.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {despesas.length === 0 && <p className="text-sm text-text-muted">Nenhuma despesa fixa cadastrada.</p>}
      </div>

      {open && (
        <NovaDespesaFixaModal
          fornecedores={fornecedores}
          onClose={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
      {editing && (
        <NovaDespesaFixaModal
          fornecedores={fornecedores}
          editing={editing}
          onClose={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

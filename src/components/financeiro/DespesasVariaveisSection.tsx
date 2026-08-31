"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DespesaOcorrenciaPagamento, DespesaVariavel, DespesaVariavelOcorrencia, Fornecedor } from "@/lib/domain/types";
import { fmtBRL } from "@/lib/domain/types";
import { fmtDatePtBR, todayISO } from "@/lib/domain/dates";
import {
  cancelarOcorrenciaDespesaVariavel,
  estornarPagamentoDespesaOcorrencia,
  listarPagamentosDespesaOcorrencia,
  registrarPagamentoDespesaVariavelOcorrencia,
  updateDespesaVariavelValor,
} from "@/lib/actions/financeiro";
import NovaDespesaVariavelModal from "./NovaDespesaVariavelModal";

function saldoDaOcorrencia(esperado: number, ocorrencia: DespesaVariavelOcorrencia | undefined): number {
  const pago = ocorrencia?.valor_pago ?? 0;
  return Math.max(0, esperado - pago);
}

function LinhaDespesaVariavel({
  despesa,
  ocorrencia,
  ano,
  mes,
  onEditar,
}: {
  despesa: DespesaVariavel;
  ocorrencia: DespesaVariavelOcorrencia | undefined;
  ano: number;
  mes: number;
  onEditar: () => void;
}) {
  const router = useRouter();
  const esperado = ocorrencia?.valor_real ?? despesa.valor_provisionado;
  const [valorEsperado, setValorEsperado] = useState(String(esperado));
  const [error, setError] = useState<string | null>(null);
  const dirty = Number(valorEsperado) !== esperado;
  const cancelada = !!ocorrencia?.cancelada_em;
  const pago = ocorrencia?.valor_pago ?? 0;
  const saldo = saldoDaOcorrencia(esperado, ocorrencia);
  const status = cancelada ? "Cancelada" : saldo <= 0 && pago > 0 ? "Pago" : pago > 0 ? "Parcial" : "A Pagar";

  const [payingOpen, setPayingOpen] = useState(false);
  const [payValor, setPayValor] = useState("");
  const [payData, setPayData] = useState(todayISO());
  const [payingSaving, setPayingSaving] = useState(false);

  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [historicoData, setHistoricoData] = useState<DespesaOcorrenciaPagamento[]>([]);
  const [historicoLoading, setHistoricoLoading] = useState(false);
  const [estornandoId, setEstornandoId] = useState<string | null>(null);

  async function salvarValorEsperado() {
    setError(null);
    const resultado = await updateDespesaVariavelValor(despesa.id, ano, mes, Number(valorEsperado) || 0);
    if (!resultado.ok) {
      setError(resultado.message);
    } else {
      router.refresh();
    }
  }

  function startPay() {
    setPayValor(String(saldo));
    setPayData(todayISO());
    setPayingOpen(true);
    setError(null);
  }

  async function confirmPay() {
    const valor = Number(payValor) || 0;
    if (valor > saldo) {
      setError(`O valor informado (${fmtBRL(valor)}) é maior que o saldo em aberto (${fmtBRL(saldo)}). Ajuste antes de confirmar.`);
      return;
    }
    setPayingSaving(true);
    setError(null);
    const resultado = await registrarPagamentoDespesaVariavelOcorrencia(despesa.id, ano, mes, valor, payData);
    if (!resultado.ok) {
      setError(resultado.message);
    } else {
      setPayingOpen(false);
      router.refresh();
    }
    setPayingSaving(false);
  }

  async function handleCancelar() {
    const motivo = prompt("Motivo do cancelamento desse mês (opcional):");
    if (motivo === null) return;
    const resultado = await cancelarOcorrenciaDespesaVariavel(despesa.id, ano, mes, motivo || null);
    if (!resultado.ok) {
      setError(resultado.message);
    } else {
      router.refresh();
    }
  }

  async function toggleHistorico() {
    if (!ocorrencia) return;
    if (historicoOpen) {
      setHistoricoOpen(false);
      return;
    }
    setHistoricoOpen(true);
    setHistoricoLoading(true);
    try {
      const pagamentos = await listarPagamentosDespesaOcorrencia("despesa_variavel_ocorrencia", ocorrencia.id);
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
    const resultado = await estornarPagamentoDespesaOcorrencia("despesa_variavel_ocorrencia", pagamentoId, motivo || null);
    if (!resultado.ok) {
      alert(resultado.message);
    } else {
      if (ocorrencia) {
        try {
          const pagamentos = await listarPagamentosDespesaOcorrencia("despesa_variavel_ocorrencia", ocorrencia.id);
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
    <div className="flex flex-col gap-1.5 rounded-btn bg-card-secondary px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onEditar} className="text-left hover:underline">
          <p className="font-medium">{despesa.descricao}</p>
          <p className="text-[11.5px] text-text-muted">
            {despesa.categoria} · provisionado {fmtBRL(despesa.valor_provisionado)}
            {status === "Parcial" && ` · pago ${fmtBRL(pago)} · saldo ${fmtBRL(saldo)}`}
          </p>
        </button>
        {cancelada ? (
          <span className="rounded-pill border border-danger-border px-2 py-0.5 text-[11px] font-semibold text-danger">Cancelada</span>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {status === "A Pagar" && (
              <>
                <input
                  type="number"
                  step="0.01"
                  value={valorEsperado}
                  onChange={(e) => setValorEsperado(e.target.value)}
                  className="w-28 rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
                  title="Valor esperado desse mês"
                />
                {dirty && (
                  <button type="button" onClick={salvarValorEsperado} className="rounded-btn bg-gold px-2.5 py-1.5 text-[11.5px] font-semibold text-bg">
                    Salvar
                  </button>
                )}
              </>
            )}
            <span className="rounded-pill px-2 py-0.5 text-[10.5px] font-semibold" style={{ color: status === "Pago" ? "#25D366" : status === "Parcial" ? "#E0A64E" : "rgba(244,242,236,0.6)" }}>
              {status}
            </span>
            {(status === "A Pagar" || status === "Parcial") && !payingOpen && (
              <button type="button" onClick={startPay} className="text-[11px] text-gold">
                {status === "Parcial" ? "Quitar / pagar mais" : "Registrar pagamento"}
              </button>
            )}
            {(status === "Pago" || status === "Parcial") && (
              <button type="button" onClick={toggleHistorico} className="text-[11px] text-text-secondary hover:text-text">
                {historicoOpen ? "Fechar histórico" : "Histórico / Estornar"}
              </button>
            )}
            {status === "A Pagar" && (
              <button type="button" onClick={handleCancelar} className="text-[11px] text-danger">
                Cancelar mês
              </button>
            )}
          </div>
        )}
      </div>

      {payingOpen && (
        <div className="flex flex-wrap items-end gap-2 rounded-btn border border-border-neutral bg-card p-2.5">
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
            onClick={confirmPay}
            disabled={payingSaving}
            className="rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-3 py-1.5 text-[12.5px] font-semibold text-bg disabled:opacity-40"
          >
            {payingSaving ? "Confirmando..." : "Confirmar pagamento"}
          </button>
          <button type="button" onClick={() => setPayingOpen(false)} className="rounded-btn px-3 py-1.5 text-[12.5px] text-text-secondary">
            Cancelar
          </button>
        </div>
      )}

      {historicoOpen && (
        <div className="flex flex-col gap-1.5 rounded-btn border border-border-neutral bg-card p-2.5">
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
          {!historicoLoading && historicoData.length === 0 && <p className="text-[11.5px] text-text-muted">Nenhum pagamento registrado ainda.</p>}
        </div>
      )}

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
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DespesaVariavel | null>(null);

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
            onEditar={() => setEditing(d)}
          />
        ))}
        {despesas.length === 0 && (
          <p className="text-sm text-text-muted">Nenhuma despesa variável cadastrada.</p>
        )}
      </div>

      {open && (
        <NovaDespesaVariavelModal
          fornecedores={fornecedores}
          onClose={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
      {editing && (
        <NovaDespesaVariavelModal
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

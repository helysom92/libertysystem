"use client";

import { useState } from "react";
import type { ServicoDetail, ServicoParcela } from "@/lib/domain/types";
import { fmtBRL } from "@/lib/domain/types";
import { fmtDatePtBR, todayISO } from "@/lib/domain/dates";
import { FINANCEIRO_STATUSES, type Role } from "@/lib/domain/flows";
import { updateFinanceiro } from "@/lib/actions/servicos";
import {
  addParcela,
  criarParcelaAvista,
  criarParcelasPadrao,
  criarParcelasPersonalizadas,
  deleteParcela,
  marcarParcelaPaga,
  updateParcela,
  type ParcelaInput,
} from "@/lib/actions/parcelas";

const FORMAS_PAGAMENTO = ["Pix", "Cartão", "Dinheiro", "Cheque"];

function emptyForm(): ParcelaInput {
  return { descricao: "", valor_previsto: 0, data_prevista: null };
}

export default function PagamentosTab({
  detail,
  role,
  onChanged,
}: {
  detail: ServicoDetail;
  role: Role;
  onChanged: () => void;
}) {
  const { servico, parcelas } = detail;
  const canEdit = role === "administrador" || role === "secretaria";
  const saldo = servico.valor - servico.valor_pago;

  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);

  const [customizando, setCustomizando] = useState(false);
  const [numParcelas, setNumParcelas] = useState(2);
  const [customRows, setCustomRows] = useState<ParcelaInput[]>([]);
  const [customSaving, setCustomSaving] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);

  const [addingParcela, setAddingParcela] = useState(false);
  const [novaParcela, setNovaParcela] = useState<ParcelaInput>(emptyForm());
  const [addError, setAddError] = useState<string | null>(null);
  const [savingAdd, setSavingAdd] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ParcelaInput>(emptyForm());
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [payingId, setPayingId] = useState<string | null>(null);
  const [payValor, setPayValor] = useState("");
  const [payData, setPayData] = useState(todayISO());
  const [payForma, setPayForma] = useState("");
  const [payingSaving, setPayingSaving] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const [quickPayingId, setQuickPayingId] = useState<string | null>(null);
  const [quickFormaFor, setQuickFormaFor] = useState<string | null>(null);
  const [quickError, setQuickError] = useState<string | null>(null);

  const [statusError, setStatusError] = useState<string | null>(null);

  async function handleSeed(tipo: "sinal" | "avista") {
    setSeeding(true);
    setSeedError(null);
    try {
      if (tipo === "sinal") await criarParcelasPadrao(servico.id);
      else await criarParcelaAvista(servico.id);
      onChanged();
    } catch (err) {
      setSeedError(err instanceof Error ? err.message : "Não foi possível gerar as parcelas.");
    } finally {
      setSeeding(false);
    }
  }

  function gerarLinhas(n: number) {
    const qtd = Math.max(1, n);
    const valorParcela = Math.round((servico.valor / qtd) * 100) / 100;
    setCustomRows(
      Array.from({ length: qtd }, (_, i) => ({
        descricao: qtd === 1 ? "Pagamento integral" : `Parcela ${i + 1}`,
        valor_previsto: valorParcela,
        data_prevista: null,
      }))
    );
  }

  function startCustom() {
    setCustomError(null);
    gerarLinhas(numParcelas);
    setCustomizando(true);
  }

  function updateCustomRow(index: number, patch: Partial<ParcelaInput>) {
    setCustomRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function removeCustomRow(index: number) {
    setCustomRows((prev) => prev.filter((_, i) => i !== index));
  }

  function addCustomRow() {
    setCustomRows((prev) => [...prev, { descricao: `Parcela ${prev.length + 1}`, valor_previsto: 0, data_prevista: null }]);
  }

  async function saveCustomRows() {
    setCustomSaving(true);
    setCustomError(null);
    try {
      await criarParcelasPersonalizadas(servico.id, customRows);
      setCustomizando(false);
      onChanged();
    } catch (err) {
      setCustomError(err instanceof Error ? err.message : "Não foi possível salvar as parcelas.");
    } finally {
      setCustomSaving(false);
    }
  }

  function startAdd() {
    setNovaParcela(emptyForm());
    setAddError(null);
    setAddingParcela(true);
  }

  async function saveNovaParcela() {
    setSavingAdd(true);
    setAddError(null);
    try {
      await addParcela(servico.id, novaParcela, parcelas.length);
      setAddingParcela(false);
      onChanged();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Não foi possível adicionar a parcela.");
    } finally {
      setSavingAdd(false);
    }
  }

  function startEdit(p: ServicoParcela) {
    setEditingId(p.id);
    setEditForm({ descricao: p.descricao, valor_previsto: p.valor_previsto, data_prevista: p.data_prevista });
    setEditError(null);
  }

  async function saveEdit(parcelaId: string) {
    setSavingEdit(true);
    setEditError(null);
    try {
      await updateParcela(parcelaId, editForm);
      setEditingId(null);
      onChanged();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Não foi possível salvar a parcela.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(parcelaId: string) {
    if (!confirm("Excluir essa parcela?")) return;
    try {
      await deleteParcela(parcelaId, servico.id);
      onChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Não foi possível excluir a parcela.");
    }
  }

  function startPay(p: ServicoParcela) {
    setPayingId(p.id);
    setPayValor(String(p.valor_previsto));
    setPayData(todayISO());
    setPayForma("");
    setPayError(null);
  }

  async function confirmPay(parcelaId: string) {
    setPayingSaving(true);
    setPayError(null);
    try {
      await marcarParcelaPaga(parcelaId, servico.id, {
        valorPago: Number(payValor) || 0,
        dataPagamento: payData,
        formaPagamento: payForma || null,
      });
      setPayingId(null);
      onChanged();
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Não foi possível confirmar o pagamento.");
    } finally {
      setPayingSaving(false);
    }
  }

  /** Salva o valor/data ajustados sem marcar como pago ainda — pra quando o combinado mudou
   * (cliente vai pagar mais/menos, ou em outra data) mas o dinheiro ainda não caiu. */
  async function saveAjuste(p: ServicoParcela) {
    setPayingSaving(true);
    setPayError(null);
    try {
      await updateParcela(p.id, {
        descricao: p.descricao,
        valor_previsto: Number(payValor) || 0,
        data_prevista: payData || null,
      });
      setPayingId(null);
      onChanged();
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Não foi possível salvar a parcela.");
    } finally {
      setPayingSaving(false);
    }
  }

  /** Confirmação rápida — clicou na caixinha, escolhe a forma de pagamento e marca como pago
   * com o valor/data já previstos, sem abrir o formulário completo. Pra quando o valor
   * recebido é diferente do combinado, use "Ajustar". */
  async function quickConfirm(p: ServicoParcela, forma: string | null) {
    setQuickPayingId(p.id);
    setQuickError(null);
    try {
      await marcarParcelaPaga(p.id, servico.id, {
        valorPago: p.valor_previsto,
        dataPagamento: todayISO(),
        formaPagamento: forma,
      });
      setQuickFormaFor(null);
      onChanged();
    } catch (err) {
      setQuickError(err instanceof Error ? err.message : "Não foi possível confirmar o pagamento.");
    } finally {
      setQuickPayingId(null);
    }
  }

  async function saveStatus(status: string) {
    setStatusError(null);
    try {
      await updateFinanceiro(servico.id, { financeiro_status: status });
      onChanged();
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Erro desconhecido ao salvar.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-card border border-border-neutral bg-card-secondary p-3">
          <p className="mb-1 text-[10.5px] tracking-wide text-text-muted uppercase">Valor Total</p>
          <p className="font-display text-sm font-bold text-gradient-gold">{fmtBRL(servico.valor)}</p>
        </div>
        <div className="rounded-card border border-border-neutral bg-card-secondary p-3">
          <p className="mb-1 text-[10.5px] tracking-wide text-text-muted uppercase">Pago</p>
          <p className="text-sm font-semibold">{fmtBRL(servico.valor_pago)}</p>
        </div>
        <div className="rounded-card border border-border-neutral bg-card-secondary p-3">
          <p className="mb-1 text-[10.5px] tracking-wide text-text-muted uppercase">Saldo</p>
          <p className="text-sm font-semibold">{fmtBRL(saldo)}</p>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-[10.5px] tracking-wide text-text-muted uppercase">
          Status Financeiro
        </label>
        <select
          defaultValue={servico.financeiro_status}
          disabled={!canEdit}
          onChange={(e) => saveStatus(e.target.value)}
          className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm disabled:opacity-50"
        >
          {FINANCEIRO_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {statusError && <p className="mt-1 text-[12px] text-danger">Não foi possível salvar: {statusError}</p>}
      </div>

      <a
        href={`/servicos/${servico.id}/imprimir`}
        target="_blank"
        rel="noreferrer"
        className="w-fit rounded-btn border border-border-neutral px-3 py-1.5 text-[12.5px] text-text-secondary"
      >
        🖨️ Imprimir / Ver documento (preço, prazo e condições)
      </a>

      {!canEdit && (
        <p className="text-[12.5px] text-text-muted">
          Apenas Administrador ou Secretaria podem alterar os pagamentos deste serviço.
        </p>
      )}

      {parcelas.length === 0 && !customizando && (
        <div className="flex flex-col gap-3 rounded-card border border-border-gold-strong bg-card-secondary p-4">
          <div>
            <p className="font-semibold">Como foi combinado o pagamento com o cliente?</p>
            <p className="text-[12.5px] text-text-muted">
              Valor total do serviço: <strong className="text-text">{fmtBRL(servico.valor)}</strong>. Assim que
              as parcelas forem criadas, elas já entram como previsto no Financeiro, com as datas combinadas.
            </p>
          </div>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleSeed("sinal")}
                disabled={seeding}
                className="w-fit rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-3 py-1.5 text-[12.5px] font-semibold text-bg disabled:opacity-40"
              >
                {seeding ? "Gerando..." : "🤝 Sinal 50% + Restante na entrega"}
              </button>
              <button
                type="button"
                onClick={() => handleSeed("avista")}
                disabled={seeding}
                className="w-fit rounded-btn border border-border-gold-strong px-3 py-1.5 text-[12.5px] text-gold disabled:opacity-40"
              >
                {seeding ? "Gerando..." : "💰 À vista (pagamento único)"}
              </button>
              <button
                type="button"
                onClick={startCustom}
                className="w-fit rounded-btn border border-border-neutral px-3 py-1.5 text-[12.5px] text-text-secondary"
              >
                ✏️ Personalizar (mais parcelas, datas diferentes)
              </button>
            </div>
          )}
          {seedError && <p className="text-[12px] text-danger">{seedError}</p>}
        </div>
      )}

      {customizando && (
        <div className="flex flex-col gap-3 rounded-card border border-border-gold-strong bg-card-secondary p-4">
          <div className="flex items-end gap-2">
            <div>
              <label className="mb-1 block text-[11px] text-text-secondary">Quantas parcelas?</label>
              <input
                type="number"
                min={1}
                value={numParcelas}
                onChange={(e) => {
                  const n = Math.max(1, Number(e.target.value) || 1);
                  setNumParcelas(n);
                  gerarLinhas(n);
                }}
                className="w-24 rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => gerarLinhas(numParcelas)}
              className="rounded-btn border border-border-gold-strong px-3 py-1.5 text-[12.5px] text-gold"
            >
              Gerar {numParcelas} parcela{numParcelas > 1 ? "s" : ""} (valor dividido igual)
            </button>
          </div>

          {customRows.map((row, index) => (
            <div key={index} className="flex items-end gap-2 rounded-btn border border-border-neutral bg-card p-2.5">
              <div className="flex-1">
                <label className="mb-1 block text-[11px] text-text-secondary">Descrição</label>
                <input
                  value={row.descricao}
                  onChange={(e) => updateCustomRow(index, { descricao: e.target.value })}
                  className="w-full rounded-btn border border-border-neutral bg-card-secondary px-2 py-1.5 text-sm"
                />
              </div>
              <div className="w-32">
                <label className="mb-1 block text-[11px] text-text-secondary">Valor</label>
                <input
                  type="number"
                  step="0.01"
                  value={row.valor_previsto}
                  onChange={(e) => updateCustomRow(index, { valor_previsto: Number(e.target.value) || 0 })}
                  className="w-full rounded-btn border border-border-neutral bg-card-secondary px-2 py-1.5 text-sm"
                />
              </div>
              <div className="w-40">
                <label className="mb-1 block text-[11px] text-text-secondary">Data prevista</label>
                <input
                  type="date"
                  value={row.data_prevista ?? ""}
                  onChange={(e) => updateCustomRow(index, { data_prevista: e.target.value || null })}
                  className="w-full rounded-btn border border-border-neutral bg-card-secondary px-2 py-1.5 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => removeCustomRow(index)}
                className="mb-1.5 text-[12.5px] text-danger"
              >
                Excluir
              </button>
            </div>
          ))}

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={addCustomRow}
              className="w-fit text-[12.5px] text-gold hover:underline"
            >
              + Adicionar mais uma parcela
            </button>
            <p className="text-[12.5px] text-text-secondary">
              Total das parcelas: {fmtBRL(customRows.reduce((s, r) => s + r.valor_previsto, 0))} · Serviço:{" "}
              {fmtBRL(servico.valor)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={saveCustomRows}
              disabled={customSaving || customRows.length === 0}
              className="rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40"
            >
              {customSaving ? "Salvando..." : "Salvar parcelas"}
            </button>
            <button
              type="button"
              onClick={() => setCustomizando(false)}
              disabled={customSaving}
              className="rounded-btn px-4 py-2 text-sm text-text-secondary"
            >
              Cancelar
            </button>
            {customError && <p className="text-[12px] text-danger">{customError}</p>}
          </div>
        </div>
      )}

      {parcelas.length > 0 && (
        <p className="text-[10.5px] tracking-wide text-text-muted uppercase">Parcelas</p>
      )}

      {parcelas.map((p) => {
        const pago = p.valor_pago != null;
        return (
          <div key={p.id} className="rounded-card border border-border-neutral bg-card-secondary p-3 text-[12.5px]">
            {editingId === p.id ? (
              <div className="flex flex-col gap-2">
                <input
                  value={editForm.descricao}
                  onChange={(e) => setEditForm((f) => ({ ...f, descricao: e.target.value }))}
                  placeholder="Descrição (ex: Sinal, Parcela 2...)"
                  className="w-full rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.valor_previsto}
                    onChange={(e) => setEditForm((f) => ({ ...f, valor_previsto: Number(e.target.value) || 0 }))}
                    placeholder="Valor previsto"
                    className="flex-1 rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
                  />
                  <input
                    type="date"
                    value={editForm.data_prevista ?? ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, data_prevista: e.target.value || null }))}
                    className="flex-1 rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => saveEdit(p.id)}
                    disabled={savingEdit}
                    className="rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-3 py-1.5 text-[12.5px] font-semibold text-bg disabled:opacity-40"
                  >
                    {savingEdit ? "Salvando..." : "Salvar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="rounded-btn px-3 py-1.5 text-[12.5px] text-text-secondary"
                  >
                    Cancelar
                  </button>
                  {editError && <p className="text-[12px] text-danger">{editError}</p>}
                </div>
              </div>
            ) : payingId === p.id ? (
              <div className="flex flex-col gap-2">
                <p className="font-semibold">Confirmar pagamento — {p.descricao}</p>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-[11px] text-text-secondary">Valor recebido</label>
                    <input
                      type="number"
                      step="0.01"
                      value={payValor}
                      onChange={(e) => setPayValor(e.target.value)}
                      className="w-full rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-[11px] text-text-secondary">Data</label>
                    <input
                      type="date"
                      value={payData}
                      onChange={(e) => setPayData(e.target.value)}
                      className="w-full rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-text-secondary">Forma de pagamento</label>
                  <div className="flex flex-wrap gap-1.5">
                    {FORMAS_PAGAMENTO.map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setPayForma((prev) => (prev === f ? "" : f))}
                        className={`rounded-btn border px-3 py-1.5 text-[12.5px] ${
                          payForma === f
                            ? "border-border-gold-strong bg-gold/15 font-semibold text-gold"
                            : "border-border-neutral text-text-secondary"
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => confirmPay(p.id)}
                    disabled={payingSaving}
                    className="rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-3 py-1.5 text-[12.5px] font-semibold text-bg disabled:opacity-40"
                  >
                    {payingSaving ? "Confirmando..." : "Confirmar recebimento"}
                  </button>
                  <button
                    type="button"
                    onClick={() => saveAjuste(p)}
                    disabled={payingSaving}
                    className="rounded-btn border border-border-gold-strong px-3 py-1.5 text-[12.5px] text-gold disabled:opacity-40"
                    title="Salva o valor/data combinados sem marcar como pago ainda"
                  >
                    Salvar (ainda não pago)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayingId(null)}
                    className="rounded-btn px-3 py-1.5 text-[12.5px] text-text-secondary"
                  >
                    Cancelar
                  </button>
                </div>
                {payError && <p className="text-[12px] text-danger">{payError}</p>}
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <strong>{p.descricao}</strong>
                    {pago ? (
                      <span className="rounded-pill bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
                        ✓ Pago
                      </span>
                    ) : (
                      <span className="rounded-pill border border-border-gold-strong px-2 py-0.5 text-[11px] text-gold">
                        Pendente
                      </span>
                    )}
                  </div>
                  <p className="text-text-muted">
                    {pago ? (
                      <>
                        {fmtBRL(p.valor_pago as number)} · {p.pago_em ? fmtDatePtBR(p.pago_em.slice(0, 10)) : ""}
                        {p.forma_pagamento && ` · ${p.forma_pagamento}`}
                      </>
                    ) : (
                      <>
                        Previsto: {fmtBRL(p.valor_previsto)}
                        {p.data_prevista && ` · ${fmtDatePtBR(p.data_prevista)}`}
                      </>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {pago ? (
                    <a
                      href={`/servicos/${servico.id}/parcelas/${p.id}/recibo`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-btn border border-border-neutral px-2.5 py-1.5 text-[11.5px] text-text-secondary"
                    >
                      🧾 Emitir recibo
                    </a>
                  ) : quickFormaFor === p.id ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11.5px] text-text-secondary">Como pagou?</span>
                      {FORMAS_PAGAMENTO.map((f) => (
                        <button
                          key={f}
                          type="button"
                          disabled={quickPayingId === p.id}
                          onClick={() => quickConfirm(p, f)}
                          className="rounded-btn border border-border-gold-strong px-2 py-1 text-[11.5px] text-gold disabled:opacity-40"
                        >
                          {f}
                        </button>
                      ))}
                      <button
                        type="button"
                        disabled={quickPayingId === p.id}
                        onClick={() => setQuickFormaFor(null)}
                        className="text-[11.5px] text-text-secondary"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    canEdit && (
                      <>
                        <label className="flex items-center gap-1.5 text-[12.5px]">
                          <input
                            type="checkbox"
                            checked={false}
                            onChange={() => setQuickFormaFor(p.id)}
                          />
                          Pago
                        </label>
                        <button
                          type="button"
                          onClick={() => startPay(p)}
                          className="text-[11.5px] text-text-secondary hover:text-text"
                        >
                          Ajustar valor
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(p)}
                          className="text-[11.5px] text-text-secondary hover:text-text"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(p.id)}
                          className="text-[11.5px] text-danger"
                        >
                          Excluir
                        </button>
                      </>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
      {quickError && <p className="text-[12px] text-danger">{quickError}</p>}

      {parcelas.length > 0 && canEdit && (
        <>
          {addingParcela ? (
            <div className="rounded-card border border-dashed border-border-gold-strong p-3">
              <div className="flex flex-col gap-2">
                <input
                  value={novaParcela.descricao}
                  onChange={(e) => setNovaParcela((f) => ({ ...f, descricao: e.target.value }))}
                  placeholder="Descrição (ex: Parcela 3, Entrada extra...)"
                  className="w-full rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    value={novaParcela.valor_previsto || ""}
                    onChange={(e) => setNovaParcela((f) => ({ ...f, valor_previsto: Number(e.target.value) || 0 }))}
                    placeholder="Valor previsto"
                    className="flex-1 rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
                  />
                  <input
                    type="date"
                    value={novaParcela.data_prevista ?? ""}
                    onChange={(e) => setNovaParcela((f) => ({ ...f, data_prevista: e.target.value || null }))}
                    className="flex-1 rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={saveNovaParcela}
                    disabled={savingAdd}
                    className="rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-3 py-1.5 text-[12.5px] font-semibold text-bg disabled:opacity-40"
                  >
                    {savingAdd ? "Salvando..." : "Adicionar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddingParcela(false)}
                    className="rounded-btn px-3 py-1.5 text-[12.5px] text-text-secondary"
                  >
                    Cancelar
                  </button>
                  {addError && <p className="text-[12px] text-danger">{addError}</p>}
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={startAdd}
              className="w-fit rounded-btn border border-border-gold-strong px-3 py-1.5 text-[12.5px] text-gold"
            >
              + Adicionar parcela
            </button>
          )}
        </>
      )}
    </div>
  );
}

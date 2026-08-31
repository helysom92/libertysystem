"use client";

import { useState } from "react";
import type { ParcelaRecebimento, ServicoDetail, ServicoParcela } from "@/lib/domain/types";
import { fmtBRL } from "@/lib/domain/types";
import { fmtDatePtBR, todayISO } from "@/lib/domain/dates";
import { FINANCEIRO_STATUSES, type Role } from "@/lib/domain/flows";
import { updateFinanceiro } from "@/lib/actions/servicos";
import {
  addParcela,
  cancelarParcela,
  criarParcelaAvista,
  criarParcelasPadrao,
  criarParcelasPersonalizadas,
  deleteParcela,
  estornarRecebimentoParcela,
  listarRecebimentosDaParcela,
  marcarParcelaPaga,
  reconfigurarParcelasPendentes,
  updateParcela,
  type ParcelaInput,
} from "@/lib/actions/parcelas";

function saldoDaParcela(p: ServicoParcela): number {
  return Math.max(0, p.valor_previsto - (p.valor_pago ?? 0));
}

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
  const [reconfigurando, setReconfigurando] = useState(false);
  const [numParcelas, setNumParcelas] = useState(2);
  const [entradaValor, setEntradaValor] = useState("");
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

  const [historicoFor, setHistoricoFor] = useState<string | null>(null);
  const [historicoData, setHistoricoData] = useState<ParcelaRecebimento[]>([]);
  const [historicoLoading, setHistoricoLoading] = useState(false);
  const [historicoError, setHistoricoError] = useState<string | null>(null);
  const [estornandoId, setEstornandoId] = useState<string | null>(null);

  async function handleSeed(tipo: "sinal" | "avista") {
    setSeeding(true);
    setSeedError(null);
    const resultado = tipo === "sinal" ? await criarParcelasPadrao(servico.id) : await criarParcelaAvista(servico.id);
    if (!resultado.ok) {
      setSeedError(resultado.message);
    } else {
      onChanged();
    }
    setSeeding(false);
  }

  /** Se tiver entrada, ela vira a 1ª linha com o valor exato e o restante do valor do serviço
   * se divide igual entre as demais — sem entrada, cai no comportamento antigo (tudo dividido
   * igual em N). Só monta um ponto de partida: cada linha continua editável depois. */
  function gerarLinhas(n: number, entrada: number) {
    const qtd = Math.max(1, n);
    if (entrada > 0) {
      const restoQtd = Math.max(1, qtd - 1);
      const restoValor = Math.max(0, servico.valor - entrada);
      const valorParcela = Math.round((restoValor / restoQtd) * 100) / 100;
      setCustomRows([
        { descricao: "Entrada", valor_previsto: entrada, data_prevista: null },
        ...Array.from({ length: restoQtd }, (_, i) => ({
          descricao: `Parcela ${i + 2}`,
          valor_previsto: valorParcela,
          data_prevista: null,
        })),
      ]);
      return;
    }
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
    setReconfigurando(false);
    setEntradaValor("");
    gerarLinhas(numParcelas, 0);
    setCustomizando(true);
  }

  /** Reabre o plano de parcelas já criado pra editar em bloco (trocar quantidade, entrada,
   * valores...) — só mexe nas que ainda não foram pagas, as pagas ficam intocadas. */
  function startReconfigurar() {
    setCustomError(null);
    setReconfigurando(true);
    setEntradaValor("");
    const pendentes = parcelas.filter((p) => p.valor_pago == null && !p.cancelada_em);
    setCustomRows(
      pendentes.map((p) => ({
        descricao: p.descricao,
        valor_previsto: p.valor_previsto,
        data_prevista: p.data_prevista,
      }))
    );
    setNumParcelas(Math.max(1, pendentes.length));
    setCustomizando(true);
  }

  /** Editar o valor de uma parcela na mão redistribui o resto igual entre as demais, pra
   * soma continuar batendo com o total (ou o saldo, se estiver reconfigurando um plano que
   * já tem parcelas pagas) sem o usuário precisar ajustar cada linha manualmente. */
  function updateCustomRow(index: number, patch: Partial<ParcelaInput>) {
    setCustomRows((prev) => {
      const next = prev.map((r, i) => (i === index ? { ...r, ...patch } : r));
      if (patch.valor_previsto == null || next.length <= 1) return next;

      const totalAlvo = reconfigurando ? saldo : servico.valor;
      const restante = Math.max(0, totalAlvo - next[index].valor_previsto);
      const outrasQtd = next.length - 1;
      const valorCada = Math.round((restante / outrasQtd) * 100) / 100;

      return next.map((r, i) => (i === index ? r : { ...r, valor_previsto: valorCada }));
    });
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
    const resultado = reconfigurando
      ? await reconfigurarParcelasPendentes(servico.id, customRows)
      : await criarParcelasPersonalizadas(servico.id, customRows);
    if (!resultado.ok) {
      setCustomError(resultado.message);
    } else {
      setCustomizando(false);
      setReconfigurando(false);
      onChanged();
    }
    setCustomSaving(false);
  }

  function startAdd() {
    setNovaParcela(emptyForm());
    setAddError(null);
    setAddingParcela(true);
  }

  async function saveNovaParcela() {
    setSavingAdd(true);
    setAddError(null);
    const resultado = await addParcela(servico.id, novaParcela, parcelas.length);
    if (!resultado.ok) {
      setAddError(resultado.message);
    } else {
      setAddingParcela(false);
      onChanged();
    }
    setSavingAdd(false);
  }

  function startEdit(p: ServicoParcela) {
    setEditingId(p.id);
    setEditForm({ descricao: p.descricao, valor_previsto: p.valor_previsto, data_prevista: p.data_prevista });
    setEditError(null);
  }

  /** Editar o valor de uma parcela já salva também redistribui o resto entre as demais
   * pendentes (as pagas não entram na conta) — mesma lógica do editor em bloco, só que
   * pra quando o ajuste é feito parcela por parcela, uma de cada vez. */
  async function saveEdit(parcelaId: string) {
    setSavingEdit(true);
    setEditError(null);
    const resultado = await updateParcela(parcelaId, editForm);
    if (!resultado.ok) {
      setEditError(resultado.message);
      setSavingEdit(false);
      return;
    }

    const outrasPendentes = parcelas.filter((p) => p.id !== parcelaId && p.valor_pago == null);
    if (outrasPendentes.length > 0) {
      const totalPago = parcelas
        .filter((p) => p.valor_pago != null)
        .reduce((sum, p) => sum + (p.valor_pago ?? 0), 0);
      const restante = Math.max(0, servico.valor - totalPago - editForm.valor_previsto);
      const valorCada = Math.round((restante / outrasPendentes.length) * 100) / 100;
      for (const p of outrasPendentes) {
        const r2 = await updateParcela(p.id, {
          descricao: p.descricao,
          valor_previsto: valorCada,
          data_prevista: p.data_prevista,
        });
        if (!r2.ok) {
          setEditError(r2.message);
          setSavingEdit(false);
          return;
        }
      }
    }

    setEditingId(null);
    onChanged();
    setSavingEdit(false);
  }

  async function handleDelete(parcelaId: string) {
    if (!confirm("Excluir essa parcela?")) return;
    const resultado = await deleteParcela(parcelaId, servico.id);
    if (!resultado.ok) {
      alert(resultado.message);
    } else {
      onChanged();
    }
  }

  function startPay(p: ServicoParcela) {
    setPayingId(p.id);
    setPayValor(String(saldoDaParcela(p)));
    setPayData(todayISO());
    setPayForma("");
    setPayError(null);
  }

  async function confirmPay(p: ServicoParcela) {
    const valor = Number(payValor) || 0;
    const saldo = saldoDaParcela(p);
    // Bloqueia de verdade — o valor não pode passar do saldo em aberto (a RPC também bloqueia
    // do lado do banco; isso aqui só evita o round-trip pra dar o mesmo erro).
    if (valor > saldo) {
      setPayError(`O valor informado (${fmtBRL(valor)}) é maior que o saldo em aberto (${fmtBRL(saldo)}). Ajuste o valor antes de confirmar.`);
      return;
    }
    setPayingSaving(true);
    setPayError(null);
    const resultado = await marcarParcelaPaga(p.id, servico.id, {
      valorRecebidoAgora: valor,
      dataPagamento: payData,
      formaPagamento: payForma || null,
    });
    if (!resultado.ok) {
      setPayError(resultado.message);
    } else {
      setPayingId(null);
      onChanged();
    }
    setPayingSaving(false);
  }

  async function handleCancelar(p: ServicoParcela) {
    const motivo = prompt("Motivo do cancelamento (opcional):");
    if (motivo === null) return; // usuário cancelou o prompt
    const resultado = await cancelarParcela(p.id, motivo || null);
    if (!resultado.ok) {
      alert(resultado.message);
    } else {
      onChanged();
    }
  }

  /** Abre/fecha a lista de recebimentos individuais dessa parcela — cada um com seu próprio
   * botão de estornar (correção pontual: antes só existia estornar a parcela inteira). */
  async function toggleHistorico(p: ServicoParcela) {
    if (historicoFor === p.id) {
      setHistoricoFor(null);
      return;
    }
    setHistoricoFor(p.id);
    setHistoricoLoading(true);
    setHistoricoError(null);
    try {
      const recebimentos = await listarRecebimentosDaParcela(p.id);
      setHistoricoData(recebimentos as ParcelaRecebimento[]);
    } catch (err) {
      setHistoricoError(err instanceof Error ? err.message : "Não foi possível carregar o histórico.");
    } finally {
      setHistoricoLoading(false);
    }
  }

  async function handleEstornarRecebimento(recebimentoId: string) {
    const motivo = prompt("Motivo do estorno (opcional):");
    if (motivo === null) return;
    setEstornandoId(recebimentoId);
    const resultado = await estornarRecebimentoParcela(recebimentoId, servico.id, motivo || null);
    if (!resultado.ok) {
      alert(resultado.message);
    } else {
      try {
        const recebimentos = await listarRecebimentosDaParcela(historicoFor as string);
        setHistoricoData(recebimentos as ParcelaRecebimento[]);
      } catch {
        // histórico não recarregou — não impede o estorno já confirmado, só não atualiza a lista aberta.
      }
      onChanged();
    }
    setEstornandoId(null);
  }

  /** Salva o valor/data ajustados sem marcar como pago ainda — pra quando o combinado mudou
   * (cliente vai pagar mais/menos, ou em outra data) mas o dinheiro ainda não caiu. */
  async function saveAjuste(p: ServicoParcela) {
    setPayingSaving(true);
    setPayError(null);
    const resultado = await updateParcela(p.id, {
      descricao: p.descricao,
      valor_previsto: Number(payValor) || 0,
      data_prevista: payData || null,
    });
    if (!resultado.ok) {
      setPayError(resultado.message);
    } else {
      setPayingId(null);
      onChanged();
    }
    setPayingSaving(false);
  }

  /** Confirmação rápida — clicou na caixinha, escolhe a forma de pagamento e marca como pago
   * com o valor/data já previstos, sem abrir o formulário completo. Pra quando o valor
   * recebido é diferente do combinado, use "Ajustar". */
  async function quickConfirm(p: ServicoParcela, forma: string | null) {
    setQuickPayingId(p.id);
    setQuickError(null);
    const resultado = await marcarParcelaPaga(p.id, servico.id, {
      valorRecebidoAgora: saldoDaParcela(p),
      dataPagamento: todayISO(),
      formaPagamento: forma,
    });
    if (!resultado.ok) {
      setQuickError(resultado.message);
    } else {
      setQuickFormaFor(null);
      onChanged();
    }
    setQuickPayingId(null);
  }

  async function saveStatus(status: string) {
    setStatusError(null);
    const resultado = await updateFinanceiro(servico.id, { financeiro_status: status });
    if (!resultado.ok) {
      setStatusError(resultado.message);
    } else {
      onChanged();
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
          {reconfigurando && (
            <p className="text-[12.5px] text-text-muted">
              Editando as parcelas ainda não pagas deste plano — as já pagas não são afetadas.
            </p>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="mb-1 block text-[11px] text-text-secondary">Valor de entrada (opcional)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={entradaValor}
                onChange={(e) => {
                  setEntradaValor(e.target.value);
                  gerarLinhas(numParcelas, Number(e.target.value) || 0);
                }}
                placeholder="0,00"
                className="w-32 rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-text-secondary">Quantas parcelas ao todo?</label>
              <input
                type="number"
                min={1}
                value={numParcelas}
                onChange={(e) => {
                  const n = Math.max(1, Number(e.target.value) || 1);
                  setNumParcelas(n);
                  gerarLinhas(n, Number(entradaValor) || 0);
                }}
                className="w-24 rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => gerarLinhas(numParcelas, Number(entradaValor) || 0)}
              className="rounded-btn border border-border-gold-strong px-3 py-1.5 text-[12.5px] text-gold"
            >
              Gerar {numParcelas} parcela{numParcelas > 1 ? "s" : ""} (resto dividido igual)
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
              Total das parcelas: {fmtBRL(customRows.reduce((s, r) => s + r.valor_previsto, 0))} ·{" "}
              {reconfigurando ? "Saldo a combinar" : "Serviço"}:{" "}
              {fmtBRL(reconfigurando ? saldo : servico.valor)}
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
              onClick={() => {
                setCustomizando(false);
                setReconfigurando(false);
              }}
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
        const cancelada = !!p.cancelada_em;
        const totalmentePago = p.valor_pago != null && saldoDaParcela(p) <= 0;
        const parcial = p.valor_pago != null && saldoDaParcela(p) > 0;
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
                <p className="font-semibold">Confirmar recebimento — {p.descricao}</p>
                {(p.valor_pago ?? 0) > 0 && (
                  <p className="text-[12px] text-text-muted">
                    Já recebido: {fmtBRL(p.valor_pago as number)} · Saldo em aberto: {fmtBRL(saldoDaParcela(p))}
                  </p>
                )}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-[11px] text-text-secondary">Valor recebido agora</label>
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
                    onClick={() => confirmPay(p)}
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
                    {cancelada ? (
                      <span className="rounded-pill border border-danger-border px-2 py-0.5 text-[11px] font-semibold text-danger">
                        Cancelada
                      </span>
                    ) : totalmentePago ? (
                      <span className="rounded-pill bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
                        ✓ Recebido
                      </span>
                    ) : parcial ? (
                      <span className="rounded-pill border border-border-gold-strong bg-gold/10 px-2 py-0.5 text-[11px] font-semibold text-gold">
                        Parcial
                      </span>
                    ) : (
                      <span className="rounded-pill border border-border-gold-strong px-2 py-0.5 text-[11px] text-gold">
                        Pendente
                      </span>
                    )}
                  </div>
                  <p className="text-text-muted">
                    {cancelada ? (
                      <>Previsto: {fmtBRL(p.valor_previsto)} · cancelada{p.motivo_cancelamento ? ` — ${p.motivo_cancelamento}` : ""}</>
                    ) : totalmentePago || parcial ? (
                      <>
                        {fmtBRL(p.valor_pago as number)} de {fmtBRL(p.valor_previsto)}
                        {parcial && ` · saldo ${fmtBRL(saldoDaParcela(p))}`} ·{" "}
                        {p.pago_em ? fmtDatePtBR(p.pago_em.slice(0, 10)) : ""}
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
                  {cancelada ? null : totalmentePago ? (
                    <>
                      <a
                        href={`/servicos/${servico.id}/parcelas/${p.id}/recibo`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-btn border border-border-neutral px-2.5 py-1.5 text-[11.5px] text-text-secondary"
                      >
                        🧾 Emitir recibo
                      </a>
                      {canEdit && (
                        <button type="button" onClick={() => toggleHistorico(p)} className="text-[11.5px] text-text-secondary hover:text-text">
                          {historicoFor === p.id ? "Fechar histórico" : "Histórico / Estornar"}
                        </button>
                      )}
                    </>
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
                        onClick={() => quickConfirm(p, null)}
                        className="text-[11.5px] text-text-secondary underline decoration-dotted hover:text-text"
                      >
                        {quickPayingId === p.id ? "Salvando..." : "Salvar sem informar"}
                      </button>
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
                        {parcial && (
                          <button
                            type="button"
                            onClick={() => toggleHistorico(p)}
                            className="text-[11.5px] text-text-secondary hover:text-text"
                          >
                            {historicoFor === p.id ? "Fechar histórico" : "Histórico / Estornar"}
                          </button>
                        )}
                        <label className="flex items-center gap-1.5 text-[12.5px]">
                          <input type="checkbox" checked={false} onChange={() => setQuickFormaFor(p.id)} />
                          {parcial ? "Quitar saldo" : "Pago"}
                        </label>
                        <button
                          type="button"
                          onClick={() => startPay(p)}
                          className="text-[11.5px] text-text-secondary hover:text-text"
                        >
                          {parcial ? "Recebimento parcial" : "Ajustar valor"}
                        </button>
                        {!parcial && (
                          <button
                            type="button"
                            onClick={() => startEdit(p)}
                            className="text-[11.5px] text-text-secondary hover:text-text"
                          >
                            Editar
                          </button>
                        )}
                        {!parcial && (
                          <button type="button" onClick={() => handleCancelar(p)} className="text-[11.5px] text-danger">
                            Cancelar
                          </button>
                        )}
                        {!parcial && (
                          <button
                            type="button"
                            onClick={() => handleDelete(p.id)}
                            className="text-[11.5px] text-danger"
                          >
                            Excluir
                          </button>
                        )}
                      </>
                    )
                  )}
                </div>
              </div>
            )}

            {historicoFor === p.id && (
              <div className="mt-2 flex flex-col gap-1.5 rounded-btn border border-border-neutral bg-card p-2.5">
                <p className="text-[10.5px] tracking-wide text-text-muted uppercase">Recebimentos desta parcela</p>
                {historicoLoading && <p className="text-[11.5px] text-text-muted">Carregando...</p>}
                {historicoError && <p className="text-[11.5px] text-danger">{historicoError}</p>}
                {!historicoLoading &&
                  !historicoError &&
                  historicoData.map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-2 rounded-btn bg-card-secondary px-2.5 py-1.5">
                      <div>
                        <p className={r.estornado_em ? "text-text-muted line-through" : ""}>
                          {fmtBRL(r.valor)} · {fmtDatePtBR(r.data)}
                          {r.forma_pagamento && ` · ${r.forma_pagamento}`}
                        </p>
                        {r.estornado_em && (
                          <p className="text-[11px] text-text-muted">
                            Estornado em {fmtDatePtBR(r.estornado_em.slice(0, 10))}
                            {r.motivo_estorno && ` — ${r.motivo_estorno}`}
                          </p>
                        )}
                      </div>
                      {!r.estornado_em && canEdit && (
                        <button
                          type="button"
                          disabled={estornandoId === r.id}
                          onClick={() => handleEstornarRecebimento(r.id)}
                          className="text-[11px] text-danger disabled:opacity-40"
                        >
                          {estornandoId === r.id ? "Estornando..." : "Estornar"}
                        </button>
                      )}
                    </div>
                  ))}
                {!historicoLoading && !historicoError && historicoData.length === 0 && (
                  <p className="text-[11.5px] text-text-muted">Nenhum recebimento registrado ainda.</p>
                )}
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
            !customizando && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={startAdd}
                  className="w-fit rounded-btn border border-border-gold-strong px-3 py-1.5 text-[12.5px] text-gold"
                >
                  + Adicionar parcela
                </button>
                {parcelas.some((p) => p.valor_pago == null && !p.cancelada_em) && (
                  <button
                    type="button"
                    onClick={startReconfigurar}
                    className="w-fit rounded-btn border border-border-neutral px-3 py-1.5 text-[12.5px] text-text-secondary"
                  >
                    ✏️ Reconfigurar parcelas
                  </button>
                )}
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}

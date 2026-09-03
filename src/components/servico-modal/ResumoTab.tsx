"use client";

import { useState, useTransition } from "react";
import type { ServicoDetail } from "@/lib/domain/types";
import { fmtBRL } from "@/lib/domain/types";
import { computeIaAlerts } from "@/lib/domain/alerts";
import { PRIORIDADES, ROLE_LABELS } from "@/lib/domain/flows";
import { PRAZO_STATUS_COLOR, PRAZO_STATUS_LABEL, PRAZO_TIPO_INFO, prazoStatus, type Coluna, type PrazoTipo } from "@/lib/domain/kanban";
import { fmtDatePtBR } from "@/lib/domain/dates";
import {
  toggleEntregaConfirmada,
  updateInformacoesAdicionais,
  updateFunilComercial,
  updatePrazoServico,
  updatePrioridade,
  updateProximaAcao,
  updateResponsavel,
  deleteServico,
  cancelarServico,
  perderOrcamento,
} from "@/lib/actions/servicos";
import { aprovarOrcamento, moveCardParaColuna } from "@/lib/actions/kanban";
import { exportarWhatsapp } from "@/lib/domain/whatsapp";
import FinanceiroBadge from "@/components/ui/FinanceiroBadge";
import ResponsavelSelect from "@/components/ui/ResponsavelSelect";

// "Meu Trabalho" (painel Hoje) filtra por `proxima_responsavel === ROLE_LABELS[role]` — esse
// select precisa continuar usando os nomes de papel (Secretaria/Administrador/Produção), ao
// contrário do "Responsável Atual" (pessoa), que não tem esse acoplamento.
const PROXIMA_ACAO_RESPONSAVEIS = ["", ...Object.values(ROLE_LABELS)];
const PRAZO_TIPOS: PrazoTipo[] = ["balcao", "fachada", "complexo"];

export default function ResumoTab({
  detail,
  colunasOS,
  onChanged,
  onClose,
}: {
  detail: ServicoDetail;
  colunasOS: Coluna[];
  onChanged: () => void;
  onClose: () => void;
}) {
  const { servico, cliente } = detail;
  const [, startTransition] = useTransition();
  const [acaoTexto, setAcaoTexto] = useState(servico.proxima_acao_texto ?? "");
  const [acaoResp, setAcaoResp] = useState(servico.proxima_responsavel ?? "");
  const [acaoPrazo, setAcaoPrazo] = useState(servico.proxima_prazo ?? "");
  const [motivoEspera, setMotivoEspera] = useState(servico.motivo_espera ?? "");
  const [acaoDirty, setAcaoDirty] = useState(false);
  const [acaoSaving, setAcaoSaving] = useState(false);
  const [acaoError, setAcaoError] = useState<string | null>(null);

  const [infoTexto, setInfoTexto] = useState(servico.informacoes_adicionais ?? "");
  const [infoDirty, setInfoDirty] = useState(false);
  const [infoSaving, setInfoSaving] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);

  const [moverPara, setMoverPara] = useState(colunasOS[0]?.id ?? "");
  const [moveError, setMoveError] = useState<string | null>(null);
  const [aprovando, setAprovando] = useState(false);
  const [miscError, setMiscError] = useState<string | null>(null);

  const [origemLead, setOrigemLead] = useState(servico.origem_lead ?? "");
  const [dataFollowUp, setDataFollowUp] = useState(servico.data_follow_up ?? "");
  const [funilDirty, setFunilDirty] = useState(false);
  const [funilSaving, setFunilSaving] = useState(false);
  const [funilError, setFunilError] = useState<string | null>(null);
  const [perdendo, setPerdendo] = useState(false);

  function runAction(fn: () => Promise<{ ok: boolean; message?: string }>, fallback: string) {
    setMiscError(null);
    startTransition(async () => {
      const resultado = await fn();
      if (!resultado.ok) {
        setMiscError(resultado.message ?? fallback);
      } else {
        onChanged();
      }
    });
  }

  const status = servico.prazo_tipo ? prazoStatus(servico.prazo_tipo, servico.prazo) : null;

  const alerts = computeIaAlerts([servico], []);
  const saldo = servico.valor - servico.valor_pago;

  async function saveProximaAcao() {
    setAcaoSaving(true);
    setAcaoError(null);
    const resultado = await updateProximaAcao(servico.id, {
      proxima_acao_texto: acaoTexto,
      proxima_responsavel: acaoResp,
      proxima_prazo: acaoPrazo,
      motivo_espera: motivoEspera,
    });
    if (!resultado.ok) {
      setAcaoError(resultado.message);
    } else {
      setAcaoDirty(false);
      onChanged();
    }
    setAcaoSaving(false);
  }

  async function saveInformacoes() {
    setInfoSaving(true);
    setInfoError(null);
    const resultado = await updateInformacoesAdicionais(servico.id, infoTexto);
    if (!resultado.ok) {
      setInfoError(resultado.message);
    } else {
      setInfoDirty(false);
      onChanged();
    }
    setInfoSaving(false);
  }

  async function handleAprovar() {
    setAprovando(true);
    setMoveError(null);
    const resultado = await aprovarOrcamento(servico.id);
    if (!resultado.ok) {
      setMoveError(resultado.message ?? "Não foi possível aprovar.");
    } else {
      onChanged();
    }
    setAprovando(false);
  }

  async function handleMover() {
    if (!moverPara) return;
    setMoveError(null);
    const resultado = await moveCardParaColuna(servico.id, moverPara);
    if (!resultado.ok) {
      setMoveError(resultado.message ?? "Não foi possível mover.");
    } else {
      onChanged();
    }
  }

  async function handleDelete() {
    if (!confirm("Excluir este serviço? Só é possível se ele não tiver nenhum recebimento/pagamento já realizado. Esta ação não pode ser desfeita.")) return;
    setMiscError(null);
    const resultado = await deleteServico(servico.id);
    if (resultado.ok) {
      onClose();
      return;
    }
    // O banco bloqueia exclusão de serviço com histórico financeiro — nesse caso, oferece
    // cancelar em vez de excluir (preserva parcelas/lançamentos, só marca como cancelado).
    if (resultado.message.includes("histórico financeiro")) {
      if (confirm(`${resultado.message}\n\nQuer cancelar o serviço em vez de excluir? (mantém os registros financeiros, só marca como cancelado)`)) {
        await handleCancelarServico();
      }
    } else {
      setMiscError(resultado.message);
    }
  }

  async function handleCancelarServico() {
    const motivo = prompt("Motivo do cancelamento (opcional):");
    if (motivo === null) return;
    setMiscError(null);
    const resultado = await cancelarServico(servico.id, motivo || null);
    if (!resultado.ok) {
      setMiscError(resultado.message);
    } else {
      onChanged();
    }
  }

  async function saveFunilComercial() {
    setFunilSaving(true);
    setFunilError(null);
    const resultado = await updateFunilComercial(servico.id, {
      origem_lead: origemLead || null,
      data_follow_up: dataFollowUp || null,
    });
    if (!resultado.ok) {
      setFunilError(resultado.message);
    } else {
      setFunilDirty(false);
      onChanged();
    }
    setFunilSaving(false);
  }

  async function handlePerderOportunidade() {
    const motivo = prompt("Motivo da perda (obrigatório):");
    if (!motivo || !motivo.trim()) return;
    setPerdendo(true);
    setMiscError(null);
    const resultado = await perderOrcamento(servico.id, motivo.trim());
    if (!resultado.ok) {
      setMiscError(resultado.message);
    } else {
      onChanged();
    }
    setPerdendo(false);
  }

  return (
    <div className="flex flex-col gap-5">
      {alerts.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-card border border-border-gold bg-card-secondary p-3">
          {alerts.map((a, i) => (
            <p key={i} className="text-[12.5px]" style={{ color: a.color }}>
              ● {a.texto}
            </p>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-card border border-border-neutral bg-card-secondary p-3">
          <p className="mb-1 text-[10.5px] tracking-wide text-text-muted uppercase">Etapa Atual</p>
          <p className="text-sm font-semibold">{servico.estagio}</p>
        </div>
        <div className="rounded-card border border-border-neutral bg-card-secondary p-3">
          <p className="mb-1 text-[10.5px] tracking-wide text-text-muted uppercase">
            Status Financeiro
          </p>
          <FinanceiroBadge status={servico.financeiro_status} />
        </div>
      </div>

      <div className="rounded-card border border-border-neutral bg-card-secondary p-3">
        <p className="mb-2 text-[10.5px] tracking-wide text-text-muted uppercase">Próxima Ação</p>
        <input
          value={acaoTexto}
          onChange={(e) => {
            setAcaoTexto(e.target.value);
            setAcaoDirty(true);
          }}
          placeholder="Texto da ação"
          className="mb-2 w-full rounded-btn border border-border-neutral bg-card px-3 py-1.5 text-sm"
        />
        <div className="flex gap-2">
          <select
            value={acaoResp}
            onChange={(e) => {
              setAcaoResp(e.target.value);
              runAction(
                () => updateProximaAcao(servico.id, { proxima_responsavel: e.target.value }),
                "Não foi possível atualizar o responsável da próxima ação."
              );
            }}
            className="flex-1 rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
          >
            {PROXIMA_ACAO_RESPONSAVEIS.map((r) => (
              <option key={r} value={r}>
                {r || "Sem responsável"}
              </option>
            ))}
          </select>
          <input
            value={acaoPrazo}
            onChange={(e) => {
              setAcaoPrazo(e.target.value);
              setAcaoDirty(true);
            }}
            placeholder="Prazo (ex: Hoje 16:00)"
            className="flex-1 rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
          />
        </div>
        <input
          value={motivoEspera}
          onChange={(e) => {
            setMotivoEspera(e.target.value);
            setAcaoDirty(true);
          }}
          placeholder="Motivo de espera (opcional)"
          className="mt-2 w-full rounded-btn border border-border-neutral bg-card px-3 py-1.5 text-sm"
        />
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={saveProximaAcao}
            disabled={!acaoDirty || acaoSaving}
            className="w-fit rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-3 py-1.5 text-[12.5px] font-semibold text-bg disabled:opacity-40"
          >
            {acaoSaving ? "Salvando..." : "Salvar"}
          </button>
          {acaoError && <p className="text-[12px] text-danger">Não foi possível salvar: {acaoError}</p>}
        </div>
      </div>

      {!servico.numero && !servico.perdido_em && (
        <div className="rounded-card border border-border-neutral bg-card-secondary p-3">
          <p className="mb-2 text-[10.5px] tracking-wide text-text-muted uppercase">Funil Comercial</p>
          <div className="flex gap-2">
            <input
              value={origemLead}
              onChange={(e) => {
                setOrigemLead(e.target.value);
                setFunilDirty(true);
              }}
              placeholder="Origem do lead (ex: Instagram, indicação)"
              className="flex-1 rounded-btn border border-border-neutral bg-card px-3 py-1.5 text-sm"
            />
            <input
              type="date"
              value={dataFollowUp}
              onChange={(e) => {
                setDataFollowUp(e.target.value);
                setFunilDirty(true);
              }}
              className="rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
            />
          </div>
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={saveFunilComercial}
              disabled={!funilDirty || funilSaving}
              className="w-fit rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-3 py-1.5 text-[12.5px] font-semibold text-bg disabled:opacity-40"
            >
              {funilSaving ? "Salvando..." : "Salvar"}
            </button>
            {funilError && <p className="text-[12px] text-danger">Não foi possível salvar: {funilError}</p>}
          </div>
          {servico.proposta_enviada_em && (
            <p className="mt-2 text-[11.5px] text-text-muted">
              Proposta enviada em {new Date(servico.proposta_enviada_em).toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>
      )}

      {servico.perdido_em && (
        <div className="rounded-card border border-danger-border bg-card-secondary p-3 text-[12.5px]">
          <p className="font-semibold text-danger">
            Oportunidade perdida em {new Date(servico.perdido_em).toLocaleDateString("pt-BR")}
          </p>
          {servico.motivo_perda && <p className="mt-1 text-text-secondary">Motivo: {servico.motivo_perda}</p>}
        </div>
      )}

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

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-[10.5px] tracking-wide text-text-muted uppercase">
            Prioridade
          </label>
          <select
            defaultValue={servico.prioridade}
            onChange={(e) =>
              runAction(
                () => updatePrioridade(servico.id, e.target.value),
                "Não foi possível atualizar a prioridade."
              )
            }
            className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
          >
            {PRIORIDADES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-[10.5px] tracking-wide text-text-muted uppercase">
            Responsável Atual
          </label>
          <ResponsavelSelect
            defaultValue={servico.responsavel}
            onSave={(value) =>
              runAction(
                () => updateResponsavel(servico.id, value),
                "Não foi possível atualizar o responsável."
              )
            }
            className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="rounded-card border border-border-gold-strong bg-card-secondary p-3">
        <p className="mb-2 text-[10.5px] tracking-wide text-text-muted uppercase">Prazo do serviço</p>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {PRAZO_TIPOS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() =>
                runAction(
                  () => updatePrazoServico(servico.id, t),
                  "Não foi possível atualizar o prazo."
                )
              }
              className={`rounded-pill border px-3 py-1.5 text-[11.5px] font-semibold ${
                servico.prazo_tipo === t
                  ? "border-transparent bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark text-bg"
                  : "border-border-gold-strong text-text-secondary"
              }`}
            >
              {PRAZO_TIPO_INFO[t].label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {status && (
            <span
              className="rounded-pill px-2 py-0.5 text-[11px] font-semibold"
              style={{ color: PRAZO_STATUS_COLOR[status], backgroundColor: `${PRAZO_STATUS_COLOR[status]}22` }}
            >
              ● {PRAZO_STATUS_LABEL[status]}
            </span>
          )}
          <span className="text-[12px] text-text-secondary">
            {servico.prazo_inicio && servico.prazo
              ? `Início ${fmtDatePtBR(servico.prazo_inicio)} · Prazo ${fmtDatePtBR(servico.prazo)}`
              : "Selecione o tipo de prazo"}
          </span>
        </div>
      </div>

      <div className="rounded-card border border-border-neutral bg-card-secondary p-3">
        <p className="mb-2 text-[10.5px] tracking-wide text-text-muted uppercase">
          Informações adicionais · medidas, materiais, observações
        </p>
        <textarea
          value={infoTexto}
          onChange={(e) => {
            setInfoTexto(e.target.value);
            setInfoDirty(true);
          }}
          rows={3}
          placeholder="Anote medidas, materiais, ferramentas, observações do local..."
          className="mb-2 w-full rounded-btn border border-border-neutral bg-card px-3 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={saveInformacoes}
          disabled={!infoDirty || infoSaving}
          className="w-fit rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-3 py-1.5 text-[12.5px] font-semibold text-bg disabled:opacity-40"
        >
          {infoSaving ? "Salvando..." : "Salvar"}
        </button>
        {infoError && <p className="mt-1.5 text-[12px] text-danger">Não foi possível salvar: {infoError}</p>}
      </div>

      {!!servico.numero && !servico.concluido && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={servico.entrega_confirmada}
            onChange={(e) => {
              const checked = e.target.checked;
              runAction(
                () => toggleEntregaConfirmada(servico.id, checked),
                "Não foi possível atualizar a entrega confirmada."
              );
            }}
          />
          Entrega confirmada
        </label>
      )}

      {miscError && <p className="text-[12.5px] text-danger">{miscError}</p>}
      {moveError && <p className="text-[12.5px] text-danger">{moveError}</p>}

      {!servico.numero ? (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={aprovando || !!servico.perdido_em}
            onClick={handleAprovar}
            title={servico.perdido_em ? "Oportunidade marcada como perdida — não pode ser aprovada" : undefined}
            className="flex-1 rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark py-2.5 text-sm font-semibold text-bg disabled:opacity-40"
          >
            {aprovando ? "Aprovando..." : "Aprovar Orçamento → Gerar OS"}
          </button>
          {!servico.perdido_em && (
            <button
              type="button"
              disabled={perdendo}
              onClick={handlePerderOportunidade}
              className="rounded-btn border border-danger-border px-3 py-2.5 text-[12.5px] text-danger disabled:opacity-40"
            >
              Perder Oportunidade
            </button>
          )}
        </div>
      ) : !servico.concluido ? (
        <div className="flex gap-2">
          <select
            value={moverPara}
            onChange={(e) => setMoverPara(e.target.value)}
            className="flex-1 rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
          >
            {colunasOS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
                {c.is_conclusao ? " (conclusão)" : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleMover}
            className="rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-4 py-2 text-sm font-semibold text-bg"
          >
            Mover
          </button>
        </div>
      ) : (
        <p className="text-center text-[12.5px] font-semibold text-success">✓ Serviço concluído</p>
      )}

      <div className="flex flex-wrap gap-2 border-t border-border-neutral pt-4">
        <button
          type="button"
          onClick={() => exportarWhatsapp(servico, cliente.whatsapp)}
          className="rounded-btn border border-border-neutral px-3 py-1.5 text-[12.5px]"
          style={{ color: "#25D366" }}
        >
          Exportar p/ WhatsApp
        </button>
        <a
          href={`/servicos/${servico.id}/imprimir`}
          target="_blank"
          rel="noreferrer"
          className="rounded-btn border border-border-neutral px-3 py-1.5 text-[12.5px] text-text-secondary"
        >
          Imprimir PDF
        </a>
        {servico.financeiro_status !== "Cancelado" && (
          <button
            type="button"
            onClick={handleCancelarServico}
            className="ml-auto rounded-btn border border-border-neutral px-3 py-1.5 text-[12.5px] text-text-secondary hover:text-text"
            title="Mantém parcelas e lançamentos — só marca o serviço como cancelado"
          >
            Cancelar Serviço
          </button>
        )}
        <button
          type="button"
          onClick={handleDelete}
          className={servico.financeiro_status === "Cancelado" ? "ml-auto rounded-btn border border-danger-border px-3 py-1.5 text-[12.5px] text-danger" : "rounded-btn border border-danger-border px-3 py-1.5 text-[12.5px] text-danger"}
        >
          Excluir
        </button>
      </div>
    </div>
  );
}

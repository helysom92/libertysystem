"use client";

import { useState, useTransition } from "react";
import type { ServicoDetail } from "@/lib/domain/types";
import { fmtBRL } from "@/lib/domain/types";
import { computeIaAlerts } from "@/lib/domain/alerts";
import { dcComplete, flowFor, PRIORIDADES, type Role } from "@/lib/domain/flows";
import {
  moveServico,
  toggleDcItem,
  toggleEntregaConfirmada,
  toggleLiberadoAdmin,
  updatePrioridade,
  updateProximaAcao,
  updateResponsavel,
  deleteServico,
} from "@/lib/actions/servicos";
import { exportarWhatsapp } from "@/lib/domain/whatsapp";
import FinanceiroBadge from "@/components/ui/FinanceiroBadge";

const RESPONSAVEIS = ["", "Secretaria", "Administrador", "Produção"];

export default function ResumoTab({
  detail,
  role,
  onChanged,
  onClose,
}: {
  detail: ServicoDetail;
  role: Role;
  onChanged: () => void;
  onClose: () => void;
}) {
  const { servico, cliente } = detail;
  const [pending, startTransition] = useTransition();
  const [acaoTexto, setAcaoTexto] = useState(servico.proxima_acao_texto ?? "");
  const [acaoResp, setAcaoResp] = useState(servico.proxima_responsavel ?? "");
  const [acaoPrazo, setAcaoPrazo] = useState(servico.proxima_prazo ?? "");
  const [motivoEspera, setMotivoEspera] = useState(servico.motivo_espera ?? "");
  const [acaoDirty, setAcaoDirty] = useState(false);
  const [acaoSaving, setAcaoSaving] = useState(false);
  const [acaoError, setAcaoError] = useState<string | null>(null);

  const flow = flowFor(servico.tipo);
  const idx = flow.indexOf(servico.estagio);
  const noBack = idx <= 0;
  const noAdvance = idx >= flow.length - 1;
  const dcOk = dcComplete(servico.dc_admin, servico.dc_producao);
  const blockedByDC = servico.estagio === "Double Check de Medidas" && !dcOk;

  const entregaOk = !flow.includes("Entrega") || servico.entrega_confirmada;
  const financeiroOk = ["Pago", "Cortesia"].includes(servico.financeiro_status) || servico.liberado_admin;
  const blockedByConclusao = idx === flow.length - 2 && !(entregaOk && financeiroOk);

  const showEntregaConfirm = flow.includes("Entrega") && servico.estagio === "Entrega";
  const showLiberarAdmin = idx === flow.length - 2 && role === "administrador";

  const dcAdminDisabled = role !== "administrador";
  const dcProducaoDisabled = !["administrador", "producao"].includes(role);

  const alerts = computeIaAlerts([servico], []);
  const saldo = servico.valor - servico.valor_pago;

  function move(dir: 1 | -1) {
    startTransition(async () => {
      await moveServico(servico.id, dir);
      onChanged();
    });
  }

  async function saveProximaAcao() {
    setAcaoSaving(true);
    setAcaoError(null);
    try {
      await updateProximaAcao(servico.id, {
        proxima_acao_texto: acaoTexto,
        proxima_responsavel: acaoResp,
        proxima_prazo: acaoPrazo,
        motivo_espera: motivoEspera,
      });
      setAcaoDirty(false);
      onChanged();
    } catch (err) {
      setAcaoError(err instanceof Error ? err.message : "Erro desconhecido ao salvar.");
    } finally {
      setAcaoSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Excluir este serviço? Esta ação não pode ser desfeita.")) return;
    await deleteServico(servico.id);
    onClose();
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

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-card border border-border-neutral bg-card-secondary p-3">
          <p className="mb-1 text-[10.5px] tracking-wide text-text-muted uppercase">
            Etapa Operacional
          </p>
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
              startTransition(async () => {
                await updateProximaAcao(servico.id, { proxima_responsavel: e.target.value });
                onChanged();
              });
            }}
            className="flex-1 rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
          >
            {RESPONSAVEIS.map((r) => (
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

      <div className="grid grid-cols-3 gap-3">
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
              startTransition(async () => {
                await updatePrioridade(servico.id, e.target.value);
                onChanged();
              })
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
          <select
            defaultValue={servico.responsavel}
            onChange={(e) =>
              startTransition(async () => {
                await updateResponsavel(servico.id, e.target.value);
                onChanged();
              })
            }
            className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
          >
            {RESPONSAVEIS.map((r) => (
              <option key={r} value={r}>
                {r || "Sem responsável"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {(servico.dc_admin.length > 0 || servico.dc_producao.length > 0) && (
        <div className="rounded-card border border-border-gold-strong bg-card-secondary p-3">
          <p className="mb-2 text-[10.5px] tracking-wide text-text-muted uppercase">
            Double Check de Medidas {dcOk ? "· Completo" : "· Pendente"}
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="mb-1.5 text-[11.5px] font-semibold text-text-secondary">
                Validação do Administrador
              </p>
              {servico.dc_admin.map((item, i) => (
                <label key={i} className="mb-1 flex items-center gap-2 text-[12.5px]">
                  <input
                    type="checkbox"
                    checked={item.done}
                    disabled={dcAdminDisabled}
                    onChange={() =>
                      startTransition(async () => {
                        await toggleDcItem(servico.id, "admin", i, servico.dc_admin);
                        onChanged();
                      })
                    }
                  />
                  {item.texto}
                </label>
              ))}
            </div>
            <div>
              <p className="mb-1.5 text-[11.5px] font-semibold text-text-secondary">
                Validação da Produção
              </p>
              {servico.dc_producao.map((item, i) => (
                <label key={i} className="mb-1 flex items-center gap-2 text-[12.5px]">
                  <input
                    type="checkbox"
                    checked={item.done}
                    disabled={dcProducaoDisabled}
                    onChange={() =>
                      startTransition(async () => {
                        await toggleDcItem(servico.id, "producao", i, servico.dc_producao);
                        onChanged();
                      })
                    }
                  />
                  {item.texto}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {showEntregaConfirm && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={servico.entrega_confirmada}
            onChange={(e) =>
              startTransition(async () => {
                await toggleEntregaConfirmada(servico.id, e.target.checked);
                onChanged();
              })
            }
          />
          Entrega confirmada
        </label>
      )}

      {showLiberarAdmin && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={servico.liberado_admin}
            onChange={(e) =>
              startTransition(async () => {
                await toggleLiberadoAdmin(servico.id, e.target.checked);
                onChanged();
              })
            }
          />
          Liberar conclusão mesmo com financeiro pendente
        </label>
      )}

      {blockedByConclusao && (
        <p className="text-[12.5px] text-danger">
          Confirme a entrega e resolva o financeiro (ou libere como Administrador) para concluir.
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={noBack || pending}
          onClick={() => move(-1)}
          className="flex-1 rounded-btn border border-border-neutral py-2 text-sm text-text-secondary disabled:opacity-30"
        >
          ◀ Voltar
        </button>
        <button
          type="button"
          disabled={noAdvance || pending || blockedByDC}
          onClick={() => move(1)}
          className="flex-1 rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark py-2 text-sm font-semibold text-bg disabled:opacity-30"
        >
          Avançar ▶
        </button>
      </div>

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
        <button
          type="button"
          onClick={handleDelete}
          className="ml-auto rounded-btn border border-danger-border px-3 py-1.5 text-[12.5px] text-danger"
        >
          Excluir
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import type { ServicoDetail } from "@/lib/domain/types";
import { computeIaAlerts } from "@/lib/domain/alerts";
import { PRIORIDADES } from "@/lib/domain/flows";
import type { Coluna } from "@/lib/domain/kanban";
import {
  toggleEntregaConfirmada,
  updatePrioridade,
  updateResponsavel,
  deleteServico,
  cancelarServico,
} from "@/lib/actions/servicos";
import { moveCardParaColuna } from "@/lib/actions/kanban";
import { whatsappAppUrl } from "@/lib/domain/whatsapp";
import ResponsavelSelect from "@/components/ui/ResponsavelSelect";

export default function StatusTab({
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
  const [moverPara, setMoverPara] = useState(colunasOS[0]?.id ?? "");
  const [moveError, setMoveError] = useState<string | null>(null);
  const [miscError, setMiscError] = useState<string | null>(null);

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

  // Produção não vê nada de dinheiro — inclusive o alerta de "saldo pendente" que o mesmo
  // computeIaAlerts gera pra Hoje/Gestão (esses continuam vendo, só aqui que é filtrado).
  const alerts = computeIaAlerts([servico], []).filter((a) => !a.texto.includes("saldo pendente"));

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

      <div className="rounded-card border border-border-neutral bg-card-secondary p-3">
        <p className="mb-1 text-[10.5px] tracking-wide text-text-muted uppercase">Cliente</p>
        <p className="text-sm font-semibold">{cliente.nome}</p>
        {cliente.whatsapp && (
          <a
            href={whatsappAppUrl(cliente.whatsapp)}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block text-[12.5px]"
            style={{ color: "#25D366" }}
          >
            {cliente.whatsapp} · Abrir WhatsApp
          </a>
        )}
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
            Responsável
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

      {!servico.concluido && (
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

      {!servico.concluido ? (
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

      <div className="ml-auto flex items-center gap-2">
        {servico.financeiro_status !== "Cancelado" && (
          <button
            type="button"
            onClick={handleCancelarServico}
            className="w-fit rounded-btn border border-border-neutral px-3 py-1.5 text-[12.5px] text-text-secondary hover:text-text"
            title="Mantém parcelas e lançamentos — só marca o serviço como cancelado"
          >
            Cancelar Serviço
          </button>
        )}
        <button
          type="button"
          onClick={handleDelete}
          className="w-fit rounded-btn border border-danger-border px-3 py-1.5 text-[12.5px] text-danger"
        >
          Excluir Serviço
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { fetchServicoDetail } from "@/lib/supabase/fetchServicoDetail";
import { displayNumero, type ItemOrcamento, type ServicoDetail } from "@/lib/domain/types";
import type { Role } from "@/lib/domain/flows";
import { exigeMedida } from "@/lib/domain/flows";
import type { Coluna } from "@/lib/domain/kanban";
import ResumoTab from "./ResumoTab";
import ClienteTab from "./ClienteTab";
import MedidasTab from "./MedidasTab";
import ArquivosTab from "./ArquivosTab";
import FotosTab from "./FotosTab";
import ChecklistTab from "./ChecklistTab";
import TimelineTab from "./TimelineTab";
import FinanceiroTab from "./FinanceiroTab";
import HistoricoTab from "./HistoricoTab";
import OrcamentoItensTab from "./OrcamentoItensTab";
import PropostaInterativaTab from "./PropostaInterativaTab";
import StatusTab from "./StatusTab";
import AgendaTab from "./AgendaTab";
import PrazoTab from "./PrazoTab";
import ExecucaoTab from "./ExecucaoTab";

// Comercial (Kanban de Orçamentos, lista de Propostas) — as mesmas abas de sempre, sem
// mudança: é onde se monta o orçamento e a proposta interativa mora.
const TABS_COMERCIAL = [
  { id: "resumo", label: "Resumo" },
  { id: "cliente", label: "Cliente" },
  { id: "itens", label: "Itens" },
  { id: "proposta", label: "Proposta Interativa" },
  { id: "medidas", label: "Medidas" },
  { id: "arquivos", label: "Arquivos" },
  { id: "fotos", label: "Fotos" },
  { id: "checklist", label: "Checklist" },
  { id: "timeline", label: "Timeline" },
  { id: "financeiro", label: "Financeiro" },
  { id: "historico", label: "Histórico" },
];

// Produção (Kanban de OS, Visão Geral de OS) — enxuto, focado em executar o serviço já
// aprovado: sem Itens/Proposta Interativa (são do orçamento) nem Financeiro (é do menu
// Financeiro agora).
const TABS_PRODUCAO = [
  { id: "status", label: "Status" },
  { id: "agenda", label: "Agenda" },
  { id: "checklist", label: "Checklist" },
  { id: "prazo", label: "Prazo" },
  { id: "execucao", label: "Execução" },
  { id: "medidas", label: "Medidas" },
  { id: "fotos", label: "Fotos" },
  { id: "arquivos", label: "Arquivos" },
  { id: "historico", label: "Histórico" },
];

export default function CentralDoServico({
  servicoId,
  role,
  context,
  itensOrcamento,
  colunasOS,
  onClose,
}: {
  servicoId: string;
  role: Role;
  context: "comercial" | "producao";
  itensOrcamento: ItemOrcamento[];
  colunasOS: Coluna[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<ServicoDetail | null>(null);
  const [tab, setTab] = useState(context === "producao" ? "status" : "resumo");
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const d = await fetchServicoDetail(servicoId);
    setDetail(d);
    setLoading(false);
    // O board por trás do modal (capa do card, badge de checklist, coluna) é renderizado no
    // servidor — sem isso ele fica com dado velho até uma navegação/refresh manual.
    router.refresh();
  }, [servicoId, router]);

  useEffect(() => {
    let cancelled = false;
    fetchServicoDetail(servicoId).then((d) => {
      if (cancelled) return;
      setDetail(d);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [servicoId]);

  const baseTabs = context === "producao" ? TABS_PRODUCAO : TABS_COMERCIAL;
  const tabs = baseTabs.filter(
    (t) => t.id !== "medidas" || (detail && exigeMedida(detail.servico.tipo))
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-3xl flex-col rounded-card border border-border-gold bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border-neutral px-6 py-4">
          <div>
            <p className="text-[11px] tracking-wide text-text-muted uppercase">
              {detail && displayNumero(detail.servico)}
            </p>
            <h2 className="font-display text-lg font-bold">{detail?.servico.cliente}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-btn px-3 py-1 text-text-secondary hover:text-text"
          >
            ✕
          </button>
        </div>

        {loading || !detail ? (
          <div className="flex flex-1 items-center justify-center text-text-muted">
            Carregando...
          </div>
        ) : (
          <>
            <div className="flex gap-1 overflow-x-auto border-b border-border-neutral px-4 pt-2">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`shrink-0 rounded-t-btn px-3 py-2 text-[12.5px] ${
                    tab === t.id
                      ? "border-b-2 border-gold font-semibold text-gold"
                      : "text-text-secondary hover:text-text"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {tab === "resumo" && (
                <ResumoTab
                  detail={detail}
                  role={role}
                  colunasOS={colunasOS}
                  onChanged={reload}
                  onClose={onClose}
                />
              )}
              {tab === "status" && (
                <StatusTab
                  detail={detail}
                  role={role}
                  colunasOS={colunasOS}
                  onChanged={reload}
                  onClose={onClose}
                />
              )}
              {tab === "agenda" && <AgendaTab detail={detail} onChanged={reload} />}
              {tab === "prazo" && <PrazoTab detail={detail} onChanged={reload} />}
              {tab === "execucao" && <ExecucaoTab detail={detail} onChanged={reload} />}
              {tab === "cliente" && <ClienteTab detail={detail} onChanged={reload} />}
              {tab === "itens" && (
                <OrcamentoItensTab detail={detail} itensOrcamento={itensOrcamento} onChanged={reload} />
              )}
              {tab === "proposta" && (
                <PropostaInterativaTab detail={detail} onChanged={reload} />
              )}
              {tab === "medidas" && <MedidasTab detail={detail} onChanged={reload} />}
              {tab === "arquivos" && <ArquivosTab detail={detail} onChanged={reload} />}
              {tab === "fotos" && <FotosTab detail={detail} onChanged={reload} />}
              {tab === "checklist" && <ChecklistTab detail={detail} onChanged={reload} />}
              {tab === "timeline" && <TimelineTab detail={detail} />}
              {tab === "financeiro" && (
                <FinanceiroTab detail={detail} role={role} onChanged={reload} />
              )}
              {tab === "historico" && <HistoricoTab detail={detail} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

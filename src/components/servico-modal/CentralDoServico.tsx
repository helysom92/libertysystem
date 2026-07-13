"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchServicoDetail } from "@/lib/supabase/fetchServicoDetail";
import type { ServicoDetail } from "@/lib/domain/types";
import type { Role } from "@/lib/domain/flows";
import { exigeMedida } from "@/lib/domain/flows";
import ResumoTab from "./ResumoTab";
import ClienteTab from "./ClienteTab";
import MedidasTab from "./MedidasTab";
import ArquivosTab from "./ArquivosTab";
import FotosTab from "./FotosTab";
import ChecklistTab from "./ChecklistTab";
import TimelineTab from "./TimelineTab";
import FinanceiroTab from "./FinanceiroTab";
import HistoricoTab from "./HistoricoTab";

const BASE_TABS = [
  { id: "resumo", label: "Resumo" },
  { id: "cliente", label: "Cliente" },
  { id: "medidas", label: "Medidas" },
  { id: "arquivos", label: "Arquivos" },
  { id: "fotos", label: "Fotos" },
  { id: "checklist", label: "Checklist" },
  { id: "timeline", label: "Timeline" },
  { id: "financeiro", label: "Financeiro" },
  { id: "historico", label: "Histórico" },
];

export default function CentralDoServico({
  servicoId,
  role,
  onClose,
}: {
  servicoId: string;
  role: Role;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<ServicoDetail | null>(null);
  const [tab, setTab] = useState("resumo");
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const d = await fetchServicoDetail(servicoId);
    setDetail(d);
    setLoading(false);
  }, [servicoId]);

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

  const tabs = BASE_TABS.filter(
    (t) => t.id !== "medidas" || (detail && exigeMedida(detail.servico.tipo))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8">
      <div className="flex h-full w-full max-w-3xl flex-col rounded-card border border-border-gold bg-card">
        <div className="flex items-center justify-between border-b border-border-neutral px-6 py-4">
          <div>
            <p className="text-[11px] tracking-wide text-text-muted uppercase">
              {detail?.servico.numero}
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
                <ResumoTab detail={detail} role={role} onChanged={reload} onClose={onClose} />
              )}
              {tab === "cliente" && <ClienteTab detail={detail} onChanged={reload} />}
              {tab === "medidas" && <MedidasTab detail={detail} onChanged={reload} />}
              {tab === "arquivos" && <ArquivosTab detail={detail} onChanged={reload} />}
              {tab === "fotos" && <FotosTab detail={detail} />}
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

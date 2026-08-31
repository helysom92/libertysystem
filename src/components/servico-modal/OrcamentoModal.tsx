"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { fetchServicoDetail } from "@/lib/supabase/fetchServicoDetail";
import type { ItemOrcamento, ServicoDetail } from "@/lib/domain/types";
import { TIPO_LABELS, type ServicoTipo } from "@/lib/domain/flows";
import { updateServicoOrcamento, deleteServico, duplicarOrcamento } from "@/lib/actions/servicos";
import { aprovarOrcamento } from "@/lib/actions/kanban";
import ClienteTab from "./ClienteTab";
import OrcamentoItensTab from "./OrcamentoItensTab";
import PropostaInterativaTab from "./PropostaInterativaTab";

/**
 * Tela única pra orçamentos ainda não aprovados — substitui a Central do Serviço (com suas
 * abas de produção: etapa/responsável/prioridade/prazo semáforo) por um formulário só, no
 * mesmo espírito do "Novo Orçamento": editar cliente, itens, proposta e mandar pro cliente,
 * tudo num lugar. Quando o orçamento vira OS (aprovado), passa a abrir a Central do Serviço
 * normal (contexto produção) — essa tela só existe enquanto `servico.numero` é nulo.
 */
export default function OrcamentoModal({
  servicoId,
  itensOrcamento,
  onClose,
}: {
  servicoId: string;
  itensOrcamento: ItemOrcamento[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<ServicoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showProposta, setShowProposta] = useState(false);

  const [tipo, setTipo] = useState<ServicoTipo>("simples");
  const [descricao, setDescricao] = useState("");
  const [prazo, setPrazo] = useState("");
  const [basicoDirty, setBasicoDirty] = useState(false);
  const [basicoSaving, setBasicoSaving] = useState(false);
  const [basicoError, setBasicoError] = useState<string | null>(null);

  const [aprovando, setAprovando] = useState(false);
  const [aprovarError, setAprovarError] = useState<string | null>(null);

  const [duplicando, setDuplicando] = useState(false);
  const [duplicarError, setDuplicarError] = useState<string | null>(null);

  const [itensDirty, setItensDirty] = useState(false);
  const hasUnsaved = basicoDirty || itensDirty;

  function handleClose() {
    if (hasUnsaved && !confirm("Você tem alterações não salvas. Fechar mesmo assim?")) return;
    onClose();
  }

  const reload = useCallback(async () => {
    const d = await fetchServicoDetail(servicoId);
    setDetail(d);
    setLoading(false);
    router.refresh();
  }, [servicoId, router]);

  useEffect(() => {
    let cancelled = false;
    fetchServicoDetail(servicoId).then((d) => {
      if (cancelled) return;
      setDetail(d);
      if (d) {
        setTipo(d.servico.tipo);
        setDescricao(d.servico.descricao ?? "");
        setPrazo(d.servico.prazo ?? "");
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [servicoId]);

  async function salvarBasico() {
    setBasicoSaving(true);
    setBasicoError(null);
    try {
      await updateServicoOrcamento(servicoId, { tipo, descricao, prazo: prazo || null });
      setBasicoDirty(false);
      await reload();
    } catch (err) {
      setBasicoError(err instanceof Error ? err.message : "Erro desconhecido ao salvar.");
    } finally {
      setBasicoSaving(false);
    }
  }

  async function handleAprovar() {
    setAprovando(true);
    setAprovarError(null);
    try {
      const result = await aprovarOrcamento(servicoId);
      if (!result.ok) {
        setAprovarError(result.reason ?? "Não foi possível aprovar.");
        return;
      }
      onClose();
      router.refresh();
    } catch (err) {
      console.error("Falha ao aprovar orçamento", err);
      setAprovarError(err instanceof Error ? err.message : "Não foi possível aprovar.");
    } finally {
      setAprovando(false);
    }
  }

  async function handleDuplicar() {
    setDuplicando(true);
    setDuplicarError(null);
    try {
      await duplicarOrcamento(servicoId);
      onClose();
      router.refresh();
    } catch (err) {
      console.error("Falha ao duplicar orçamento", err);
      setDuplicarError(err instanceof Error ? err.message : "Não foi possível duplicar esse orçamento.");
    } finally {
      setDuplicando(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Excluir este orçamento? Esta ação não pode ser desfeita.")) return;
    const resultado = await deleteServico(servicoId);
    if (!resultado.ok) {
      alert(resultado.message);
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8">
      <div
        className="flex h-full w-full max-w-2xl flex-col rounded-card border border-border-gold bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border-neutral px-6 py-4">
          <div>
            <p className="text-[11px] tracking-wide text-text-muted uppercase">Orçamento</p>
            <h2 className="font-display text-lg font-bold">{detail?.servico.cliente}</h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-btn px-3 py-1 text-text-secondary hover:text-text"
          >
            ✕
          </button>
        </div>

        {loading || !detail ? (
          <div className="flex flex-1 items-center justify-center text-text-muted">Carregando...</div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mb-5 flex flex-col gap-3 rounded-card border border-border-neutral bg-card-secondary p-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-[10.5px] tracking-wide text-text-muted uppercase">
                    Tipo de serviço
                  </label>
                  <select
                    value={tipo}
                    onChange={(e) => {
                      setTipo(e.target.value as ServicoTipo);
                      setBasicoDirty(true);
                    }}
                    className="w-full rounded-btn border border-border-neutral bg-card px-3 py-2 text-sm"
                  >
                    {Object.entries(TIPO_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-[10.5px] tracking-wide text-text-muted uppercase">
                    Prazo (data)
                  </label>
                  <input
                    type="date"
                    value={prazo}
                    onChange={(e) => {
                      setPrazo(e.target.value);
                      setBasicoDirty(true);
                    }}
                    className="w-full rounded-btn border border-border-neutral bg-card px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[10.5px] tracking-wide text-text-muted uppercase">
                  Descrição geral
                </label>
                <input
                  value={descricao}
                  onChange={(e) => {
                    setDescricao(e.target.value);
                    setBasicoDirty(true);
                  }}
                  className="w-full rounded-btn border border-border-neutral bg-card px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={salvarBasico}
                  disabled={!basicoDirty || basicoSaving}
                  className="w-fit rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-3 py-1.5 text-[12.5px] font-semibold text-bg disabled:opacity-40"
                >
                  {basicoSaving ? "Salvando..." : "Salvar"}
                </button>
                {basicoError && <p className="text-[12px] text-danger">{basicoError}</p>}
              </div>
            </div>

            <p className="mb-2 text-[10.5px] tracking-wide text-text-muted uppercase">Cliente</p>
            <div className="mb-5">
              <ClienteTab detail={detail} onChanged={reload} />
            </div>

            <p className="mb-2 text-[10.5px] tracking-wide text-text-muted uppercase">
              Itens, proposta e envio
            </p>
            <div className="mb-5">
              <OrcamentoItensTab
                detail={detail}
                itensOrcamento={itensOrcamento}
                onChanged={reload}
                onDirtyChange={setItensDirty}
              />
            </div>

            <div className="mb-5">
              <button
                type="button"
                onClick={() => setShowProposta((v) => !v)}
                className="w-fit rounded-btn border border-border-gold-strong px-3 py-1.5 text-[12.5px] text-gold"
              >
                {showProposta ? "▾" : "▸"} Criar Proposta Personalizada (cliente escolhe a linha)
              </button>
              {showProposta && (
                <div className="mt-3">
                  <PropostaInterativaTab detail={detail} onChanged={reload} />
                </div>
              )}
            </div>

            {aprovarError && <p className="mb-2 text-[12.5px] text-danger">{aprovarError}</p>}
            {duplicarError && <p className="mb-2 text-[12.5px] text-danger">{duplicarError}</p>}

            <div className="flex items-center gap-2 border-t border-border-neutral pt-4">
              <button
                type="button"
                disabled={aprovando}
                onClick={handleAprovar}
                className="flex-1 rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark py-2.5 text-sm font-semibold text-bg disabled:opacity-40"
              >
                {aprovando ? "Aprovando..." : "Aprovar Orçamento → Gerar OS"}
              </button>
              <button
                type="button"
                disabled={duplicando}
                onClick={handleDuplicar}
                title="Cria um orçamento novo com o mesmo cliente, proposta e itens"
                className="rounded-btn border border-border-gold-strong px-3 py-2.5 text-[12.5px] text-gold disabled:opacity-40"
              >
                {duplicando ? "Duplicando..." : "⧉ Duplicar"}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-btn border border-danger-border px-3 py-2.5 text-[12.5px] text-danger"
              >
                Excluir
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

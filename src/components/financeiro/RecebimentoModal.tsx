"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { fetchServicoDetail } from "@/lib/supabase/fetchServicoDetail";
import { displayNumero, type ServicoDetail } from "@/lib/domain/types";
import type { Role } from "@/lib/domain/flows";
import { whatsappAppUrl } from "@/lib/domain/whatsapp";
import PagamentosTab from "@/components/servico-modal/PagamentosTab";

/**
 * Mesma OS que aparece na Produção, aberta a partir do Financeiro — só que aqui o foco é
 * pagamento: cliente (referência rápida) + a aba de Parcelas por completo. Informações de
 * tamanho/medidas/fotos/etc ficam na Central do Serviço (Produção), não aqui.
 */
export default function RecebimentoModal({
  servicoId,
  role,
  onClose,
}: {
  servicoId: string;
  role: Role;
  onClose: () => void;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<ServicoDetail | null>(null);
  const [loading, setLoading] = useState(true);

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
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [servicoId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8">
      <div
        className="flex h-full w-full max-w-2xl flex-col rounded-card border border-border-gold bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border-neutral px-6 py-4">
          <div>
            <p className="text-[11px] tracking-wide text-text-muted uppercase">
              {detail && displayNumero(detail.servico)}
            </p>
            <h2 className="font-display text-lg font-bold">{detail?.servico.cliente}</h2>
            {detail?.cliente.whatsapp && (
              <a
                href={whatsappAppUrl(detail.cliente.whatsapp)}
                target="_blank"
                rel="noreferrer"
                className="text-[12px]"
                style={{ color: "#25D366" }}
              >
                {detail.cliente.whatsapp} · Abrir WhatsApp
              </a>
            )}
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
          <div className="flex flex-1 items-center justify-center text-text-muted">Carregando...</div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6">
            <PagamentosTab detail={detail} role={role} onChanged={reload} />
          </div>
        )}
      </div>
    </div>
  );
}

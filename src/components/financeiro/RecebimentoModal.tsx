"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { fetchServicoDetail } from "@/lib/supabase/fetchServicoDetail";
import { displayNumero, fmtBRL, type ServicoDetail } from "@/lib/domain/types";
import { TIPO_LABELS, type Role } from "@/lib/domain/flows";
import { fmtDatePtBR } from "@/lib/domain/dates";
import { whatsappAppUrl } from "@/lib/domain/whatsapp";
import PagamentosTab from "@/components/servico-modal/PagamentosTab";
import ClienteServicosModal from "./ClienteServicosModal";

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
  const [showClienteServicos, setShowClienteServicos] = useState(false);

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
            <div className="mb-4 rounded-card border border-border-neutral bg-card-secondary p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10.5px] tracking-wide text-text-muted uppercase">
                  Detalhes do serviço (pra nota fiscal)
                </p>
                <button
                  type="button"
                  onClick={() => setShowClienteServicos(true)}
                  className="text-[11.5px] text-gold hover:underline"
                >
                  Ver todos os serviços deste cliente
                </button>
              </div>
              <p className="mb-1 text-[12.5px]">
                <span className="text-text-muted">Descrição: </span>
                {detail.servico.descricao || "—"}
              </p>
              <p className="mb-1 text-[12.5px]">
                <span className="text-text-muted">Tipo: </span>
                {TIPO_LABELS[detail.servico.tipo]}
              </p>
              <p className="mb-1 text-[12.5px]">
                <span className="text-text-muted">CPF/CNPJ: </span>
                {detail.cliente.cpf_cnpj || "não cadastrado"}
                {" · "}
                <span className="text-text-muted">Endereço: </span>
                {detail.cliente.endereco || "não cadastrado"}
              </p>
              <p className="mb-2 text-[12.5px]">
                <span className="text-text-muted">Criado: </span>
                {fmtDatePtBR(detail.servico.criado_em.slice(0, 10))}
                {detail.servico.aprovado_em && (
                  <>
                    {" · "}
                    <span className="text-text-muted">Aprovado: </span>
                    {fmtDatePtBR(detail.servico.aprovado_em.slice(0, 10))}
                  </>
                )}
                {detail.servico.concluido_em && (
                  <>
                    {" · "}
                    <span className="text-text-muted">Concluído: </span>
                    {fmtDatePtBR(detail.servico.concluido_em.slice(0, 10))}
                  </>
                )}
              </p>
              {detail.orcamentoItens.length > 0 && (
                <div className="border-t border-border-neutral pt-2">
                  <p className="mb-1 text-[10.5px] tracking-wide text-text-muted uppercase">Itens</p>
                  {detail.orcamentoItens.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-[12px]">
                      <span className="text-text-secondary">{item.descricao || "(sem descrição)"}</span>
                      <span className="font-semibold">{fmtBRL(item.valor_final)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <PagamentosTab detail={detail} role={role} onChanged={reload} />
          </div>
        )}
      </div>

      {showClienteServicos && detail && (
        <ClienteServicosModal
          clienteId={detail.cliente.id}
          clienteNome={detail.cliente.nome}
          clienteCpfCnpj={detail.cliente.cpf_cnpj}
          clienteEndereco={detail.cliente.endereco}
          onClose={() => setShowClienteServicos(false)}
        />
      )}
    </div>
  );
}

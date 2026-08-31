"use client";

import { useEffect, useState, useTransition } from "react";
import { fmtBRL } from "@/lib/domain/types";
import { fmtDatePtBR } from "@/lib/domain/dates";

interface ItemLedger {
  id: string;
  valor: number;
  data: string;
  estornado_em: string | null;
  motivo_estorno: string | null;
}

export default function HistoricoPessoalModal({
  titulo,
  carregar,
  onEstornar,
  onFechar,
}: {
  titulo: string;
  carregar: () => Promise<ItemLedger[]>;
  onEstornar: (id: string, motivo: string | null) => Promise<{ ok: boolean; message?: string }>;
  onFechar: () => void;
}) {
  const [itens, setItens] = useState<ItemLedger[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, startTransition] = useTransition();
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelado = false;
    startTransition(async () => {
      try {
        const dados = await carregar();
        if (!cancelado) setItens(dados);
      } catch {
        if (!cancelado) setError("Não foi possível carregar o histórico.");
      }
    });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  function estornar(id: string) {
    const motivo = window.prompt("Motivo do estorno (opcional):") ?? "";
    startTransition(async () => {
      const resultado = await onEstornar(id, motivo || null);
      if (resultado.ok) {
        setRefreshKey((k) => k + 1);
      } else {
        setError(resultado.message ?? "Não foi possível estornar.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onFechar}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-card border border-border-gold bg-card p-6">
        <h2 className="mb-4 font-display text-lg font-bold">{titulo}</h2>
        {error && <p className="mb-3 text-sm text-danger">{error}</p>}
        {loading && itens.length === 0 ? (
          <p className="py-4 text-center text-text-muted">Carregando...</p>
        ) : (
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {itens.map((i) => (
              <div key={i.id} className="flex items-center justify-between rounded-btn border border-border-neutral px-3 py-2 text-[12.5px]">
                <div>
                  <p className={i.estornado_em ? "text-text-muted line-through" : "font-semibold text-text"}>{fmtBRL(i.valor)}</p>
                  <p className="text-text-muted">
                    {fmtDatePtBR(i.data)}
                    {i.estornado_em ? ` · estornado${i.motivo_estorno ? `: ${i.motivo_estorno}` : ""}` : ""}
                  </p>
                </div>
                {!i.estornado_em && (
                  <button type="button" onClick={() => estornar(i.id)} className="text-danger hover:underline">
                    Estornar
                  </button>
                )}
              </div>
            ))}
            {itens.length === 0 && <p className="py-4 text-center text-text-muted">Nenhum registro ainda.</p>}
          </div>
        )}
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onFechar} className="rounded-btn px-4 py-2 text-sm text-text-secondary hover:text-text">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

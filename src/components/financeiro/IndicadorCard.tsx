"use client";

import { fmtBRL } from "@/lib/domain/types";

/** Cartão clicável dos indicadores oficiais (Etapa 3) — nunca mostra R$0,00 quando `error`
 * está setado (mensagem + "Tentar novamente" no lugar), e sempre expõe `quantidade` quando
 * fizer sentido pro indicador. */
export default function IndicadorCard({
  titulo,
  valor,
  quantidade,
  mesLabel,
  tom = "neutro",
  loading,
  error,
  onRetry,
  onClick,
}: {
  titulo: string;
  valor: number;
  quantidade?: number;
  mesLabel: string;
  tom?: "neutro" | "bom" | "atencao";
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onClick?: () => void;
}) {
  const corValor = tom === "bom" ? "text-success" : tom === "atencao" ? "text-danger" : "text-gradient-gold";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="flex flex-col items-start gap-1 rounded-card border border-border-neutral bg-card p-4 text-left transition-colors enabled:hover:border-border-gold-strong enabled:hover:bg-card-secondary disabled:cursor-default"
    >
      <p className="text-[10.5px] tracking-wide text-text-muted uppercase">{titulo}</p>
      {loading ? (
        <div className="h-7 w-24 animate-pulse rounded bg-card-secondary" />
      ) : error ? (
        <div className="flex flex-col gap-1">
          <p className="text-[12.5px] text-danger">Erro ao carregar</p>
          {onRetry && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRetry();
              }}
              className="w-fit text-[11.5px] text-gold underline"
            >
              Tentar novamente
            </button>
          )}
        </div>
      ) : (
        <p className={`font-display text-xl font-bold ${corValor}`}>{fmtBRL(valor)}</p>
      )}
      <p className="text-[11px] text-text-muted">
        {mesLabel}
        {!loading && !error && quantidade != null && ` · ${quantidade} registro${quantidade === 1 ? "" : "s"}`}
      </p>
    </button>
  );
}

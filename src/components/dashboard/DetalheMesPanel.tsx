"use client";

import { useEffect, useState, useTransition } from "react";
import { pendenciasDoMes } from "@/lib/actions/extrato";
import { fmtBRL } from "@/lib/domain/types";

function Linha({ label, valor, cor }: { label: string; valor: number; cor?: string }) {
  return (
    <div className="flex items-center justify-between rounded-btn bg-card-secondary px-3 py-2.5 text-[13px]">
      <span className="text-text-secondary">{label}</span>
      <span className="font-semibold" style={cor ? { color: cor } : undefined}>
        {fmtBRL(valor)}
      </span>
    </div>
  );
}

/** Detalhamento completo do mês, aberto ao clicar em qualquer KPI da Visão Geral — junta
 * números que hoje ficam espalhados (faturamento, receita realizada, despesas) com o que
 * ainda falta entrar/pagar naquele mês (reaproveita `pendenciasDoMes`, já usado no
 * fechamento em Gestão › Conferência). */
export default function DetalheMesPanel({
  ano,
  mes,
  faturamentoMes,
  receitaRealizada,
  despesaRealizada,
}: {
  ano: number;
  mes: number;
  faturamentoMes: number;
  receitaRealizada: number;
  despesaRealizada: number;
}) {
  const [loading, startTransition] = useTransition();
  const [receitaPrevista, setReceitaPrevista] = useState<number | null>(null);
  const [despesasEmAberto, setDespesasEmAberto] = useState<number | null>(null);

  useEffect(() => {
    let cancelado = false;
    startTransition(async () => {
      try {
        const r = await pendenciasDoMes(ano, mes);
        if (cancelado) return;
        setReceitaPrevista(r.receitasNaoRecebidas.reduce((sum, i) => sum + i.valor, 0));
        setDespesasEmAberto(
          r.despesasNaoPagas.reduce((sum, i) => sum + i.valor, 0) +
            r.despesasPrevistasNaoPagas.reduce((sum, i) => sum + i.valor, 0)
        );
      } catch {
        if (!cancelado) {
          setReceitaPrevista(null);
          setDespesasEmAberto(null);
        }
      }
    });
    return () => {
      cancelado = true;
    };
  }, [ano, mes]);

  const lucroPrevisto = receitaPrevista != null && despesasEmAberto != null ? receitaPrevista - despesasEmAberto : null;

  return (
    <div className="mb-5 rounded-card border border-border-gold bg-card p-5">
      <p className="mb-3 font-display text-[15px] font-bold text-text">Detalhamento do mês</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Linha label="Vendas no mês (faturamento)" valor={faturamentoMes} />
        <Linha label="Recebido (receita realizada)" valor={receitaRealizada} />
        <Linha label="Despesas pagas" valor={despesaRealizada} />
        {loading || despesasEmAberto == null ? (
          <p className="col-span-full text-[12px] text-text-muted">Carregando o que falta entrar/pagar...</p>
        ) : (
          <>
            <Linha label="Despesas em aberto" valor={despesasEmAberto} cor="var(--color-danger)" />
            <Linha label="Receita prevista (a receber)" valor={receitaPrevista ?? 0} cor="var(--color-gold)" />
            <Linha
              label="Lucro previsto (o que ainda falta)"
              valor={lucroPrevisto ?? 0}
              cor={(lucroPrevisto ?? 0) >= 0 ? "var(--color-success)" : "var(--color-danger)"}
            />
          </>
        )}
      </div>
    </div>
  );
}

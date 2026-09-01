"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { IndicadorFinanceiro } from "@/lib/domain/financas";
import IndicadorCard from "./IndicadorCard";
import DetalhamentoIndicadorModal from "./DetalhamentoIndicadorModal";

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export interface DadosVisaoGeral {
  recebido: IndicadorFinanceiro;
  despesasPagas: IndicadorFinanceiro;
  aReceber: IndicadorFinanceiro;
  recebimentosVencidos: IndicadorFinanceiro;
  aPagar: IndicadorFinanceiro;
  despesasVencidas: IndicadorFinanceiro;
  resultadoRealizado: number;
  resultadoPendente: number;
  resultadoPrevistoFinal: number;
  // Etapa 6 (Gestão) — opcionais porque o Financeiro (pendências do dia a dia) não os usa,
  // só a Visão Geral de Gestão.
  osAbertas?: IndicadorFinanceiro;
  osAtrasadas?: IndicadorFinanceiro;
  propostasAguardando?: IndicadorFinanceiro;
  propostasVencidas?: IndicadorFinanceiro;
}

type CartaoAberto =
  | { tipo: "indicador"; titulo: string; indicador: IndicadorFinanceiro }
  | { tipo: "memoria"; titulo: string; linhas: { label: string; valor: number; destaque?: boolean }[] }
  | null;

/** Orquestra os 9 cartões oficiais da Etapa 3 — só chama funções já calculadas em
 * `financeiro/visao-geral/page.tsx` a partir de `financas.ts`, nunca recalcula nada aqui. */
export default function VisaoGeralFinanceiroClient({
  erro,
  dados,
  podeVerResultado,
  ano,
  mes,
}: {
  erro: string | null;
  dados: DadosVisaoGeral | null;
  podeVerResultado: boolean;
  ano: number;
  mes: number;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState<CartaoAberto>(null);
  const mesLabel = `${MESES[mes - 1]}/${ano}`;

  if (erro) {
    return (
      <div className="rounded-card border border-danger-border bg-card-secondary p-4">
        <p className="text-sm text-danger">Não foi possível carregar os indicadores financeiros: {erro}</p>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="mt-2 rounded-btn border border-border-gold-strong px-3 py-1.5 text-[12.5px] text-gold"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!dados) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <IndicadorCard key={i} titulo="" valor={0} mesLabel="" loading />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <IndicadorCard
          titulo="Recebido no mês"
          valor={dados.recebido.total}
          quantidade={dados.recebido.quantidade}
          mesLabel={mesLabel}
          tom="bom"
          onClick={() => setAberto({ tipo: "indicador", titulo: "Recebido no mês", indicador: dados.recebido })}
        />
        <IndicadorCard
          titulo="A receber no mês"
          valor={dados.aReceber.total}
          quantidade={dados.aReceber.quantidade}
          mesLabel={mesLabel}
          onClick={() => setAberto({ tipo: "indicador", titulo: "A receber no mês", indicador: dados.aReceber })}
        />
        <IndicadorCard
          titulo="Recebimentos vencidos"
          valor={dados.recebimentosVencidos.total}
          quantidade={dados.recebimentosVencidos.quantidade}
          mesLabel="Até hoje"
          tom={dados.recebimentosVencidos.total > 0 ? "atencao" : "neutro"}
          onClick={() => setAberto({ tipo: "indicador", titulo: "Recebimentos vencidos", indicador: dados.recebimentosVencidos })}
        />
        <IndicadorCard
          titulo="Despesas pagas no mês"
          valor={dados.despesasPagas.total}
          quantidade={dados.despesasPagas.quantidade}
          mesLabel={mesLabel}
          onClick={() => setAberto({ tipo: "indicador", titulo: "Despesas pagas no mês", indicador: dados.despesasPagas })}
        />
        <IndicadorCard
          titulo="A pagar no mês"
          valor={dados.aPagar.total}
          quantidade={dados.aPagar.quantidade}
          mesLabel={mesLabel}
          onClick={() => setAberto({ tipo: "indicador", titulo: "A pagar no mês", indicador: dados.aPagar })}
        />
        <IndicadorCard
          titulo="Despesas vencidas"
          valor={dados.despesasVencidas.total}
          quantidade={dados.despesasVencidas.quantidade}
          mesLabel="Até hoje"
          tom={dados.despesasVencidas.total > 0 ? "atencao" : "neutro"}
          onClick={() => setAberto({ tipo: "indicador", titulo: "Despesas vencidas", indicador: dados.despesasVencidas })}
        />
      </div>

      {podeVerResultado && (
        <div className="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <IndicadorCard
            titulo="Resultado realizado"
            valor={dados.resultadoRealizado}
            mesLabel={mesLabel}
            tom={dados.resultadoRealizado >= 0 ? "bom" : "atencao"}
            onClick={() =>
              setAberto({
                tipo: "memoria",
                titulo: "Resultado realizado",
                linhas: [
                  { label: "Recebido", valor: dados.recebido.total },
                  { label: "Despesas pagas", valor: dados.despesasPagas.total },
                  { label: "Resultado realizado", valor: dados.resultadoRealizado, destaque: true },
                ],
              })
            }
          />
          <IndicadorCard
            titulo="Resultado pendente"
            valor={dados.resultadoPendente}
            mesLabel={mesLabel}
            tom={dados.resultadoPendente >= 0 ? "bom" : "atencao"}
            onClick={() =>
              setAberto({
                tipo: "memoria",
                titulo: "Resultado pendente",
                linhas: [
                  { label: "A receber", valor: dados.aReceber.total },
                  { label: "A pagar", valor: dados.aPagar.total },
                  { label: "Resultado pendente", valor: dados.resultadoPendente, destaque: true },
                ],
              })
            }
          />
          <IndicadorCard
            titulo="Resultado previsto final"
            valor={dados.resultadoPrevistoFinal}
            mesLabel={mesLabel}
            tom={dados.resultadoPrevistoFinal >= 0 ? "bom" : "atencao"}
            onClick={() =>
              setAberto({
                tipo: "memoria",
                titulo: "Resultado previsto final",
                linhas: [
                  { label: "Recebido", valor: dados.recebido.total },
                  { label: "A receber", valor: dados.aReceber.total },
                  { label: "Despesas pagas", valor: dados.despesasPagas.total },
                  { label: "A pagar", valor: dados.aPagar.total },
                  { label: "Resultado previsto final", valor: dados.resultadoPrevistoFinal, destaque: true },
                ],
              })
            }
          />
        </div>
      )}

      {(dados.osAbertas || dados.osAtrasadas || dados.propostasAguardando || dados.propostasVencidas) && (
        <div className="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {dados.osAbertas && (
            <IndicadorCard
              titulo="OS abertas"
              valor={dados.osAbertas.total}
              quantidade={dados.osAbertas.quantidade}
              mesLabel="Agora"
              onClick={() => setAberto({ tipo: "indicador", titulo: "OS abertas", indicador: dados.osAbertas! })}
            />
          )}
          {dados.osAtrasadas && (
            <IndicadorCard
              titulo="OS atrasadas"
              valor={dados.osAtrasadas.total}
              quantidade={dados.osAtrasadas.quantidade}
              mesLabel="Agora"
              tom={dados.osAtrasadas.quantidade > 0 ? "atencao" : "neutro"}
              onClick={() => setAberto({ tipo: "indicador", titulo: "OS atrasadas", indicador: dados.osAtrasadas! })}
            />
          )}
          {dados.propostasAguardando && (
            <IndicadorCard
              titulo="Propostas aguardando"
              valor={dados.propostasAguardando.total}
              quantidade={dados.propostasAguardando.quantidade}
              mesLabel="Agora"
              onClick={() =>
                setAberto({ tipo: "indicador", titulo: "Propostas aguardando resposta", indicador: dados.propostasAguardando! })
              }
            />
          )}
          {dados.propostasVencidas && (
            <IndicadorCard
              titulo="Propostas vencidas"
              valor={dados.propostasVencidas.total}
              quantidade={dados.propostasVencidas.quantidade}
              mesLabel="Agora"
              tom={dados.propostasVencidas.quantidade > 0 ? "atencao" : "neutro"}
              onClick={() =>
                setAberto({ tipo: "indicador", titulo: "Propostas vencidas", indicador: dados.propostasVencidas! })
              }
            />
          )}
        </div>
      )}

      {aberto?.tipo === "indicador" && (
        <DetalhamentoIndicadorModal titulo={aberto.titulo} indicador={aberto.indicador} onClose={() => setAberto(null)} />
      )}
      {aberto?.tipo === "memoria" && (
        <DetalhamentoIndicadorModal titulo={aberto.titulo} memoria={aberto.linhas} onClose={() => setAberto(null)} />
      )}
    </>
  );
}

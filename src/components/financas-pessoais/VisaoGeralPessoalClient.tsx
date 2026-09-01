"use client";

import { useState } from "react";
import type { IndicadorFinanceiro } from "@/lib/domain/financas";
import { fmtBRL } from "@/lib/domain/types";
import IndicadorCard from "@/components/financeiro/IndicadorCard";
import DetalhamentoIndicadorModal from "@/components/financeiro/DetalhamentoIndicadorModal";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

interface DadosVisaoGeralPessoal {
  recebido: IndicadorFinanceiro;
  pago: IndicadorFinanceiro;
  aReceber: IndicadorFinanceiro & { vencidos: IndicadorFinanceiro["registros"] };
  aPagar: IndicadorFinanceiro & { vencidos: IndicadorFinanceiro["registros"] };
  resultadoRealizado: number;
  saldoDisponivel: number;
  contasComSaldoConhecido: boolean;
  totalInvestido: number;
  totalDividas: number;
  faturasEmAberto: number;
  patrimonioLiquido: number;
}

type CartaoAberto =
  | { tipo: "indicador"; titulo: string; indicador: IndicadorFinanceiro }
  | { tipo: "memoria"; titulo: string; linhas: { label: string; valor: number; destaque?: boolean }[] }
  | null;

export default function VisaoGeralPessoalClient({ dados, ano, mes }: { dados: DadosVisaoGeralPessoal | null; ano: number; mes: number }) {
  const [aberto, setAberto] = useState<CartaoAberto>(null);
  const mesLabel = `${MESES[mes - 1]}/${ano}`;

  if (!dados) return null;

  return (
    <div>
      <div
        className="mb-5 cursor-pointer rounded-card border border-border-gold bg-card p-5"
        onClick={() =>
          setAberto({
            tipo: "memoria",
            titulo: "Patrimônio líquido",
            linhas: [
              { label: "Saldo disponível nas contas", valor: dados.saldoDisponivel },
              { label: "Total investido", valor: dados.totalInvestido },
              { label: "Dívidas ativas (saldo devedor)", valor: -dados.totalDividas },
              { label: "Faturas de cartão em aberto", valor: -dados.faturasEmAberto },
              { label: "Patrimônio líquido", valor: dados.patrimonioLiquido, destaque: true },
            ],
          })
        }
      >
        <p className="text-[10.5px] tracking-wide text-text-muted uppercase">Patrimônio líquido</p>
        <p className={`font-display text-2xl font-bold ${dados.patrimonioLiquido >= 0 ? "text-gradient-gold" : "text-danger"}`}>
          {fmtBRL(dados.patrimonioLiquido)}
        </p>
        <p className="mt-1 text-[11px] text-text-muted">
          Contas + investimentos − dívidas − faturas em aberto · clique pra ver a memória de cálculo
        </p>
      </div>

      <div className="mb-1 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <IndicadorCard
          titulo="Receitas recebidas no mês"
          valor={dados.recebido.total}
          quantidade={dados.recebido.quantidade}
          mesLabel={mesLabel}
          tom="bom"
          onClick={() => setAberto({ tipo: "indicador", titulo: "Receitas recebidas no mês", indicador: dados.recebido })}
        />
        <IndicadorCard
          titulo="Receitas previstas em aberto"
          valor={dados.aReceber.total}
          quantidade={dados.aReceber.quantidade}
          mesLabel={mesLabel}
          onClick={() => setAberto({ tipo: "indicador", titulo: "Receitas previstas em aberto", indicador: dados.aReceber })}
        />
        <IndicadorCard
          titulo="Compromissos vencidos (receber)"
          valor={dados.aReceber.vencidos.reduce((s, r) => s + r.valor, 0)}
          quantidade={dados.aReceber.vencidos.length}
          mesLabel="Até hoje"
          tom={dados.aReceber.vencidos.length > 0 ? "atencao" : "neutro"}
          onClick={() =>
            setAberto({
              tipo: "indicador",
              titulo: "Receitas vencidas",
              indicador: { ...dados.aReceber, registros: dados.aReceber.vencidos, total: dados.aReceber.vencidos.reduce((s, r) => s + r.valor, 0), quantidade: dados.aReceber.vencidos.length },
            })
          }
        />
        <IndicadorCard
          titulo="Saídas pagas no mês"
          valor={dados.pago.total}
          quantidade={dados.pago.quantidade}
          mesLabel={mesLabel}
          onClick={() => setAberto({ tipo: "indicador", titulo: "Saídas pagas no mês", indicador: dados.pago })}
        />
        <IndicadorCard
          titulo="Compromissos a pagar no mês"
          valor={dados.aPagar.total}
          quantidade={dados.aPagar.quantidade}
          mesLabel={mesLabel}
          onClick={() => setAberto({ tipo: "indicador", titulo: "Compromissos a pagar no mês", indicador: dados.aPagar })}
        />
        <IndicadorCard
          titulo="Compromissos vencidos (pagar)"
          valor={dados.aPagar.vencidos.reduce((s, r) => s + r.valor, 0)}
          quantidade={dados.aPagar.vencidos.length}
          mesLabel="Até hoje"
          tom={dados.aPagar.vencidos.length > 0 ? "atencao" : "neutro"}
          onClick={() =>
            setAberto({
              tipo: "indicador",
              titulo: "Despesas vencidas",
              indicador: { ...dados.aPagar, registros: dados.aPagar.vencidos, total: dados.aPagar.vencidos.reduce((s, r) => s + r.valor, 0), quantidade: dados.aPagar.vencidos.length },
            })
          }
        />
      </div>

      <div className="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <IndicadorCard
          titulo="Resultado de caixa realizado"
          valor={dados.resultadoRealizado}
          mesLabel={mesLabel}
          tom={dados.resultadoRealizado >= 0 ? "bom" : "atencao"}
          onClick={() =>
            setAberto({
              tipo: "memoria",
              titulo: "Resultado de caixa realizado",
              linhas: [
                { label: "Receitas recebidas", valor: dados.recebido.total },
                { label: "Saídas pagas", valor: dados.pago.total },
                { label: "Resultado de caixa realizado", valor: dados.resultadoRealizado, destaque: true },
              ],
            })
          }
        />
        <div className="flex flex-col items-start gap-1 rounded-card border border-border-neutral bg-card p-4">
          <p className="text-[10.5px] tracking-wide text-text-muted uppercase">Saldo disponível nas contas</p>
          <p className="font-display text-xl font-bold text-gradient-gold">{fmtBRL(dados.saldoDisponivel)}</p>
          <p className="text-[11px] text-text-muted">
            {dados.contasComSaldoConhecido ? "Posição atual — não é um número do mês" : "Cadastre uma conta pra ver o saldo aqui"}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col items-start gap-1 rounded-card border border-border-neutral bg-card p-4">
          <p className="text-[10.5px] tracking-wide text-text-muted uppercase">Total investido</p>
          <p className="font-display text-lg font-bold text-text">{fmtBRL(dados.totalInvestido)}</p>
          <p className="text-[11px] text-text-muted">Posição atual, todos os investimentos ativos</p>
        </div>
        <div className="flex flex-col items-start gap-1 rounded-card border border-border-neutral bg-card p-4">
          <p className="text-[10.5px] tracking-wide text-text-muted uppercase">Dívidas ativas</p>
          <p className={`font-display text-lg font-bold ${dados.totalDividas > 0 ? "text-danger" : "text-text"}`}>
            {fmtBRL(dados.totalDividas)}
          </p>
          <p className="text-[11px] text-text-muted">Saldo devedor atual</p>
        </div>
        <div className="flex flex-col items-start gap-1 rounded-card border border-border-neutral bg-card p-4">
          <p className="text-[10.5px] tracking-wide text-text-muted uppercase">Faturas de cartão em aberto</p>
          <p className={`font-display text-lg font-bold ${dados.faturasEmAberto > 0 ? "text-danger" : "text-text"}`}>
            {fmtBRL(dados.faturasEmAberto)}
          </p>
          <p className="text-[11px] text-text-muted">Compras já feitas, fatura ainda não paga</p>
        </div>
      </div>

      {aberto?.tipo === "indicador" && (
        <DetalhamentoIndicadorModal titulo={aberto.titulo} indicador={aberto.indicador} onClose={() => setAberto(null)} />
      )}
      {aberto?.tipo === "memoria" && (
        <DetalhamentoIndicadorModal titulo={aberto.titulo} memoria={aberto.linhas} onClose={() => setAberto(null)} />
      )}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import {
  alertasComerciais,
  aprovadosNoMes,
  orcamentosDoMes,
  perdidosNoMes,
  propostasAguardandoResposta,
  propostasEnviadasNoMes,
  propostasSemFollowUp,
  propostasVencidas,
  taxaConversao,
  ticketMedioAprovado,
  type RegistroComercial,
} from "@/lib/domain/comercial";
import type { PeriodoFiltro } from "@/lib/domain/financas";
import { fmtBRL, type ItemOrcamento, type Servico } from "@/lib/domain/types";
import type { Coluna } from "@/lib/domain/kanban";

/** `RegistroComercial.data` é sempre um timestamp ISO completo (criado_em/aprovado_em/
 * proposta_enviada_em/perdido_em), nunca uma data pura — `fmtDatePtBR` (que espera
 * "YYYY-MM-DD") não serve aqui. */
function fmtTimestampPtBR(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}
import CentralDoServico from "@/components/servico-modal/CentralDoServico";

interface Cartao {
  id: string;
  titulo: string;
  valorLabel: string;
  subLabel: string;
  registros: RegistroComercial[];
}

export default function IndicadoresComercialClient({
  servicos,
  colunas,
  itensOrcamento,
  periodo,
  hojeISO,
}: {
  servicos: Servico[];
  colunas: Coluna[];
  itensOrcamento: ItemOrcamento[];
  periodo: PeriodoFiltro;
  hojeISO: string;
}) {
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const mesLabel = new Date(periodo.ano, periodo.mes - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  const { cartoes, alertas } = useMemo(() => {
    const orcamentos = orcamentosDoMes(servicos, periodo);
    const enviadas = propostasEnviadasNoMes(servicos, periodo);
    const aprovados = aprovadosNoMes(servicos, periodo);
    const perdidos = perdidosNoMes(servicos, periodo);
    const conversao = taxaConversao(aprovados.quantidade, perdidos.quantidade);
    const ticket = ticketMedioAprovado(aprovados);
    const aguardando = propostasAguardandoResposta(servicos);
    const semFollowUp = propostasSemFollowUp(servicos);
    const vencidas = propostasVencidas(servicos, hojeISO);

    const cartoes: Cartao[] = [
      { id: "orcamentos", titulo: "Orçamentos no mês", valorLabel: String(orcamentos.quantidade), subLabel: fmtBRL(orcamentos.total), registros: orcamentos.registros },
      { id: "enviadas", titulo: "Propostas enviadas", valorLabel: String(enviadas.quantidade), subLabel: fmtBRL(enviadas.total), registros: enviadas.registros },
      { id: "aprovados", titulo: "Aprovados", valorLabel: String(aprovados.quantidade), subLabel: fmtBRL(aprovados.total), registros: aprovados.registros },
      { id: "perdidos", titulo: "Perdidos", valorLabel: String(perdidos.quantidade), subLabel: fmtBRL(perdidos.total), registros: perdidos.registros },
      { id: "conversao", titulo: "Taxa de conversão", valorLabel: `${(conversao * 100).toFixed(0)}%`, subLabel: "aprovados / (aprovados + perdidos)", registros: [] },
      { id: "ticket", titulo: "Ticket médio aprovado", valorLabel: fmtBRL(ticket), subLabel: `${aprovados.quantidade} aprovado(s) no mês`, registros: [] },
      { id: "aguardando", titulo: "Aguardando resposta", valorLabel: String(aguardando.length), subLabel: "propostas enviadas, sem desfecho", registros: aguardando },
      { id: "semFollowUp", titulo: "Sem follow-up agendado", valorLabel: String(semFollowUp.length), subLabel: "risco de esquecer de cobrar", registros: semFollowUp },
      { id: "vencidas", titulo: "Propostas vencidas", valorLabel: String(vencidas.length), subLabel: "validade já passou", registros: vencidas },
    ];

    const alertas = alertasComerciais(servicos, hojeISO);

    return { cartoes, alertas };
  }, [servicos, periodo, hojeISO]);

  const cartaoAberto = cartoes.find((c) => c.id === abertoId);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-xl font-bold">Indicadores Comerciais</h1>
        <p className="text-[13px] text-text-secondary capitalize">{mesLabel} · funil de orçamentos, sem rentabilidade por OS</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {cartoes.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => c.registros.length > 0 && setAbertoId(abertoId === c.id ? null : c.id)}
            disabled={c.registros.length === 0 && c.id !== "conversao" && c.id !== "ticket"}
            className={`flex flex-col items-start gap-1 rounded-card border p-3 text-left transition-colors ${
              abertoId === c.id ? "border-gold" : "border-border-neutral hover:border-border-gold-strong"
            }`}
          >
            <p className="text-[10.5px] tracking-wide text-text-muted uppercase">{c.titulo}</p>
            <p className="font-display text-xl font-bold text-gradient-gold">{c.valorLabel}</p>
            <p className="text-[11px] text-text-muted">{c.subLabel}</p>
          </button>
        ))}
      </div>

      {cartaoAberto && cartaoAberto.registros.length > 0 && (
        <div className="rounded-card border border-border-neutral bg-card-secondary p-3">
          <p className="mb-2 text-[11px] tracking-wide text-text-muted uppercase">{cartaoAberto.titulo}</p>
          <div className="flex flex-col gap-1">
            {cartaoAberto.registros.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setOpenId(r.id)}
                className="flex items-center justify-between rounded-btn px-3 py-2 text-left text-[12.5px] hover:bg-card"
              >
                <span>{r.descricao}</span>
                <span className="text-text-muted">
                  {fmtBRL(r.valor)} · {fmtTimestampPtBR(r.data)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {alertas.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] tracking-wide text-text-muted uppercase">Atenção</p>
          <div className="flex flex-col gap-1.5">
            {alertas.map((a, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setOpenId(a.servicoId)}
                className="rounded-card border border-border-neutral bg-card-secondary px-3 py-2 text-left text-[12.5px] hover:bg-card"
                style={{ color: a.cor }}
              >
                ● {a.texto}
              </button>
            ))}
          </div>
        </div>
      )}

      {openId && (
        <CentralDoServico
          servicoId={openId}
          context="comercial"
          itensOrcamento={itensOrcamento}
          colunasOS={colunas.filter((c) => c.board === "os")}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

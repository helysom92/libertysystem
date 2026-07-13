import { dcComplete } from "./flows";
import { daysUntil, type Servico } from "./types";

export function naoConcluidos(servicos: Servico[]): Servico[] {
  return servicos.filter((s) => s.estagio !== "Concluído");
}

export function atrasados(servicos: Servico[]): Servico[] {
  return naoConcluidos(servicos).filter((s) => {
    const d = daysUntil(s.prazo);
    return d !== null && d < 0;
  });
}

export function dcPendenteList(servicos: Servico[]): Servico[] {
  return servicos.filter(
    (s) => s.estagio === "Double Check de Medidas" && !dcComplete(s.dc_admin, s.dc_producao)
  );
}

export function instalacoesHoje(servicos: Servico[]): Servico[] {
  return servicos.filter((s) => s.estagio === "Instalação" && daysUntil(s.prazo) === 0);
}

export function emProducao(servicos: Servico[]): Servico[] {
  return servicos.filter((s) =>
    ["Arquivo Final", "Produção", "Acabamento", "Criação"].includes(s.estagio)
  );
}

/** All outstanding balance across active serviços. */
export function caixaPrevisto(servicos: Servico[]): number {
  return naoConcluidos(servicos).reduce((acc, s) => acc + Math.max(0, s.valor - s.valor_pago), 0);
}

/**
 * Near-term (prazo within the next 7 days) outstanding balance — a genuinely distinct
 * metric from Caixa Previsto (the prototype computed both from the same number; see
 * plan §4 "Decision default (KPI split)").
 */
export function recebimentosPrevistos(servicos: Servico[]): number {
  return naoConcluidos(servicos)
    .filter((s) => {
      const d = daysUntil(s.prazo);
      return d !== null && d >= 0 && d <= 7;
    })
    .reduce((acc, s) => acc + Math.max(0, s.valor - s.valor_pago), 0);
}

export interface KpisAdmin {
  atrasados: number;
  dcPendente: number;
  instalacoesHoje: number;
  caixaPrevisto: number;
  recebimentosPrevistos: number;
  emProducao: number;
}

export function computeKpisAdmin(servicos: Servico[]): KpisAdmin {
  return {
    atrasados: atrasados(servicos).length,
    dcPendente: dcPendenteList(servicos).length,
    instalacoesHoje: instalacoesHoje(servicos).length,
    caixaPrevisto: caixaPrevisto(servicos),
    recebimentosPrevistos: recebimentosPrevistos(servicos),
    emProducao: emProducao(servicos).length,
  };
}

export interface KpisProducao {
  osAbertas: number;
  entreguesMes: number;
  instalacoesHoje: number;
  visitasTecnicasPendentes: number;
  emProducao: number;
  dcPendenteProducao: number;
}

export function computeKpisProducao(servicos: Servico[], today: Date = new Date()): KpisProducao {
  const entreguesMes = servicos.filter((s) => {
    if (s.estagio !== "Concluído" || !s.concluido_em) return false;
    const d = new Date(s.concluido_em);
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  }).length;

  const dcPendenteProducao = dcPendenteList(servicos).filter(
    (s) => !s.dc_producao.every((i) => i.done)
  ).length;

  return {
    osAbertas: naoConcluidos(servicos).length,
    entreguesMes,
    instalacoesHoje: instalacoesHoje(servicos).length,
    visitasTecnicasPendentes: servicos.filter((s) => s.estagio === "Visita Técnica").length,
    emProducao: emProducao(servicos).length,
    dcPendenteProducao,
  };
}

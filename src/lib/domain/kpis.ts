import { daysUntil, type Servico } from "./types";

export function naoConcluidos(servicos: Servico[]): Servico[] {
  return servicos.filter((s) => !s.concluido);
}

export function atrasados(servicos: Servico[]): Servico[] {
  return naoConcluidos(servicos).filter((s) => {
    const d = daysUntil(s.prazo);
    return d !== null && d < 0;
  });
}

/** Serviços não concluídos com prazo hoje. */
export function instalacoesHoje(servicos: Servico[]): Servico[] {
  return servicos.filter((s) => !s.concluido && daysUntil(s.prazo) === 0);
}

/** OS ativas: já aprovadas (numeradas), ainda não concluídas. */
export function emProducao(servicos: Servico[]): Servico[] {
  return servicos.filter((s) => s.numero != null && !s.concluido);
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
  instalacoesHoje: number;
  caixaPrevisto: number;
  recebimentosPrevistos: number;
  emProducao: number;
}

export function computeKpisAdmin(servicos: Servico[]): KpisAdmin {
  return {
    atrasados: atrasados(servicos).length,
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
  emProducao: number;
}

export function computeKpisProducao(servicos: Servico[], today: Date = new Date()): KpisProducao {
  const entreguesMes = servicos.filter((s) => {
    if (!s.concluido || !s.concluido_em) return false;
    const d = new Date(s.concluido_em);
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  }).length;

  return {
    osAbertas: naoConcluidos(servicos).length,
    entreguesMes,
    instalacoesHoje: instalacoesHoje(servicos).length,
    emProducao: emProducao(servicos).length,
  };
}

import { normalizarBusca } from "./texto";
import type { Lancamento, UnidadeNegocio } from "./types";

export const UNIDADES: { valor: UnidadeNegocio; rotulo: string }[] = [
  { valor: "comunicacao_visual", rotulo: "Comunicação Visual" },
  { valor: "digital", rotulo: "Digital" },
  { valor: "outros", rotulo: "Outros" },
];

export function rotuloUnidade(unidade: UnidadeNegocio): string {
  return UNIDADES.find((u) => u.valor === unidade)?.rotulo ?? unidade;
}

/** Lançamento sem unidade marcada conta como Comunicação Visual — o histórico anterior à
 * separação não muda, e "Digital" só existe quando alguém marcou de propósito. */
export function unidadeEfetiva(l: Pick<Lancamento, "unidade_negocio">): UnidadeNegocio {
  return l.unidade_negocio ?? "comunicacao_visual";
}

export type FiltroUnidade = UnidadeNegocio | "todas";

export function filtrarPorUnidade<T extends Pick<Lancamento, "unidade_negocio">>(
  lancamentos: T[],
  filtro: FiltroUnidade
): T[] {
  if (filtro === "todas") return lancamentos;
  return lancamentos.filter((l) => unidadeEfetiva(l) === filtro);
}

export interface RegraLancamento {
  id: string;
  padrao: string;
  tipo: "Receita" | "Despesa" | null;
  categoria: string | null;
  unidade_negocio: UnidadeNegocio | null;
  recorrencia: "nenhuma" | "mensal";
  valor_tipico: number | null;
  ativo: boolean;
  criado_em: string;
}

/** Acha a regra ativa cujo padrão aparece no texto (sem acento/caixa). Se mais de uma casar,
 * vence a de padrão mais longo — "agencia lupa" é mais específica que "lupa". */
export function sugerirPorRegra(
  texto: string,
  tipo: "Receita" | "Despesa",
  regras: RegraLancamento[]
): RegraLancamento | null {
  const alvo = normalizarBusca(texto);
  if (!alvo) return null;
  let melhor: { regra: RegraLancamento; tamanho: number } | null = null;
  for (const regra of regras) {
    if (!regra.ativo) continue;
    if (regra.tipo !== null && regra.tipo !== tipo) continue;
    const padrao = normalizarBusca(regra.padrao);
    if (!padrao || !alvo.includes(padrao)) continue;
    if (!melhor || padrao.length > melhor.tamanho) melhor = { regra, tamanho: padrao.length };
  }
  return melhor?.regra ?? null;
}

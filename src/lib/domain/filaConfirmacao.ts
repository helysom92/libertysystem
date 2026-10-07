import { diasEntre, ehMovimentacaoInterna } from "./extrato";
import { sugerirPorRegra, type RegraLancamento } from "./regras";
import type { Lancamento, UnidadeNegocio } from "./types";

export interface MovimentoSincronizado {
  id: string;
  data: string;
  descricao: string;
  contraparte: string | null;
  valor: number;
  tipo: "Receita" | "Despesa";
  conciliado: boolean;
  ignorado_em: string | null;
}

export interface ItemFila {
  movimento: MovimentoSincronizado;
  regra: RegraLancamento | null;
  categoriaSugerida: string;
  unidadeSugerida: UnidadeNegocio | null;
  /** Lançamentos *previstos* (ex: boleto já lançado) que parecem ser esta saída/entrada — o
   * caminho certo é dar baixa neles, em vez de criar um lançamento duplicado. */
  baixas: Lancamento[];
}

export interface FilaClassificada {
  itens: ItemFila[];
  jaLancados: number;
}

const JANELA_REALIZADO_DIAS = 5;
const JANELA_BAIXA_DIAS = 7;

function mesmoValor(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.01;
}

export function deslocarISO(iso: string, dias: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Separa o que ainda precisa da sua confirmação: ignora o que já foi conciliado/ignorado, o
 * que já bate com um lançamento realizado (nada a fazer) e movimentação interna; do resto,
 * sugere "dar baixa" quando há um lançamento previsto equivalente, ou "lançar novo" com a
 * categoria/unidade da regra aprendida. Nunca cria nada — só classifica.
 */
export function classificarMovimentos(
  movimentos: MovimentoSincronizado[],
  lancamentos: Lancamento[],
  regras: RegraLancamento[],
  meuNome: string
): FilaClassificada {
  const pendentes = movimentos
    .filter((m) => !m.conciliado && !m.ignorado_em)
    .sort((a, b) => a.data.localeCompare(b.data));
  const validos = lancamentos.filter((l) => l.status !== "cancelado");
  const realizados = validos.filter((l) => l.status === "realizado");
  const previstos = validos.filter((l) => l.status === "previsto");

  const usadosRealizado = new Set<string>();
  const usadosPrevisto = new Set<string>();
  const itens: ItemFila[] = [];
  let jaLancados = 0;

  for (const m of pendentes) {
    const texto = [m.contraparte, m.descricao].filter(Boolean).join(" ");
    if (ehMovimentacaoInterna(texto, meuNome)) continue;

    const jaTem = realizados.find(
      (l) =>
        !usadosRealizado.has(l.id) &&
        l.tipo === m.tipo &&
        mesmoValor(l.valor, m.valor) &&
        diasEntre(l.data, m.data) <= JANELA_REALIZADO_DIAS
    );
    if (jaTem) {
      usadosRealizado.add(jaTem.id);
      jaLancados += 1;
      continue;
    }

    const baixas = previstos
      .filter(
        (l) =>
          !usadosPrevisto.has(l.id) &&
          l.tipo === m.tipo &&
          mesmoValor(l.valor, m.valor) &&
          diasEntre(l.data, m.data) <= JANELA_BAIXA_DIAS
      )
      .sort((a, b) => diasEntre(a.data, m.data) - diasEntre(b.data, m.data))
      .slice(0, 3);
    if (baixas[0]) usadosPrevisto.add(baixas[0].id);

    const regra = sugerirPorRegra(texto, m.tipo, regras);
    itens.push({
      movimento: m,
      regra,
      categoriaSugerida: regra?.categoria || "Geral",
      unidadeSugerida: regra?.unidade_negocio ?? null,
      baixas,
    });
  }

  return { itens, jaLancados };
}

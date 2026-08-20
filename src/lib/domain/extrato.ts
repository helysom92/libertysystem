import type { Lancamento } from "./types";

export interface LinhaExtrato {
  data: string;
  descricao: string;
  valor: number;
  tipo: "Receita" | "Despesa";
}

export interface AchadoConciliacao {
  tipo: "faltando" | "duplicata_provavel";
  linhaExtrato?: LinhaExtrato;
  lancamentoSobrando?: Lancamento;
  lancamentoOriginal?: Lancamento;
  motivo: string;
}

export interface ConciliacaoResultado {
  achados: AchadoConciliacao[];
  internas: LinhaExtrato[];
  batendo: number;
}

const PALAVRAS_INTERNAS = ["reservado", "retirado"];

function diasEntre(a: string, b: string): number {
  const da = new Date(a + "T00:00:00").getTime();
  const db = new Date(b + "T00:00:00").getTime();
  return Math.abs(da - db) / 86400000;
}

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function ehMovimentacaoInterna(descricao: string, meuNome: string): boolean {
  const d = normalizar(descricao);
  if (meuNome.trim() && d.includes(normalizar(meuNome))) return true;
  return PALAVRAS_INTERNAS.some((p) => d.includes(p));
}

/**
 * Cruza as linhas extraídas do extrato com os lançamentos já cadastrados no período.
 * Match por valor exato + data próxima (até 5 dias) — mesma heurística usada manualmente
 * na conferência feita em conversa antes dessa ferramenta existir.
 */
export function conciliarExtrato(
  linhas: LinhaExtrato[],
  lancamentos: Lancamento[],
  meuNome: string
): ConciliacaoResultado {
  const internas: LinhaExtrato[] = [];
  const externas: LinhaExtrato[] = [];
  for (const linha of linhas) {
    if (ehMovimentacaoInterna(linha.descricao, meuNome)) internas.push(linha);
    else externas.push(linha);
  }

  const usados = new Set<string>();
  const achados: AchadoConciliacao[] = [];
  let batendo = 0;

  for (const linha of externas) {
    const match = lancamentos.find(
      (l) =>
        !usados.has(l.id) &&
        l.tipo === linha.tipo &&
        Math.abs(l.valor - linha.valor) < 0.01 &&
        diasEntre(l.data, linha.data) <= 5
    );
    if (match) {
      usados.add(match.id);
      batendo += 1;
    } else {
      achados.push({
        tipo: "faltando",
        linhaExtrato: linha,
        motivo: "Sem lançamento correspondente no sistema",
      });
    }
  }

  // Duplicata provável: dois lançamentos do período com mesma data+valor+descrição parecida.
  for (let i = 0; i < lancamentos.length; i++) {
    for (let j = i + 1; j < lancamentos.length; j++) {
      const a = lancamentos[i];
      const b = lancamentos[j];
      if (
        a.tipo === b.tipo &&
        Math.abs(a.valor - b.valor) < 0.01 &&
        normalizar(a.descricao) === normalizar(b.descricao) &&
        diasEntre(a.data, b.data) <= 3
      ) {
        achados.push({
          tipo: "duplicata_provavel",
          lancamentoOriginal: a,
          lancamentoSobrando: b,
          motivo: "Mesma descrição, valor e data próxima — pode ser lançado 2x",
        });
      }
    }
  }

  return { achados, internas, batendo };
}

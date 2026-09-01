import type { LinhaExtratoPessoal } from "./extratoPessoal";

/**
 * Leitor de CSV de extrato — alternativa ao PDF-por-IA (Bloco E) que não depende de nenhuma
 * chave de API: parsing determinístico, 100% local. Aceita as variações mais comuns de extrato
 * de banco brasileiro: delimitador vírgula ou ponto-e-vírgula, valor com vírgula decimal
 * ("1.234,56") ou ponto decimal ("1234.56"), data em "DD/MM/AAAA" ou "AAAA-MM-DD", e tanto uma
 * coluna "Valor" com sinal quanto colunas separadas "Débito"/"Crédito".
 *
 * Nunca lança exceção — linha que não dá pra entender vira um erro na lista `erros`, sem
 * travar a leitura das outras. Mesmo princípio do resto do Bloco E: só uma prévia, nada é
 * salvo sozinho.
 */

export interface ResultadoParseCsv {
  linhas: LinhaExtratoPessoal[];
  erros: string[];
}

const ALIASES_DATA = ["data", "date", "dt"];
const ALIASES_DESCRICAO = ["descricao", "descrição", "historico", "histórico", "memo", "lançamento", "lancamento", "detalhes"];
const ALIASES_VALOR = ["valor", "amount", "valor (r$)", "valor(r$)"];
const ALIASES_DEBITO = ["debito", "débito", "saída", "saida"];
const ALIASES_CREDITO = ["credito", "crédito", "entrada"];

function normalizarCabecalho(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** Tokeniza uma linha CSV respeitando aspas (campo com o delimitador dentro fica intacto) —
 * suporte mínimo ao RFC 4180 (aspas duplicadas "" viram uma aspas literal). */
function parseLinhaCsv(linha: string, delimitador: string): string[] {
  const campos: string[] = [];
  let atual = "";
  let dentroAspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (dentroAspas) {
      if (c === '"') {
        if (linha[i + 1] === '"') {
          atual += '"';
          i++;
        } else {
          dentroAspas = false;
        }
      } else {
        atual += c;
      }
    } else if (c === '"') {
      dentroAspas = true;
    } else if (c === delimitador) {
      campos.push(atual);
      atual = "";
    } else {
      atual += c;
    }
  }
  campos.push(atual);
  return campos.map((c) => c.trim());
}

function detectarDelimitador(linhaCabecalho: string): string {
  const qtdPontoVirgula = (linhaCabecalho.match(/;/g) ?? []).length;
  const qtdVirgula = (linhaCabecalho.match(/,/g) ?? []).length;
  return qtdPontoVirgula > qtdVirgula ? ";" : ",";
}

/** Aceita "1.234,56" (formato BR), "1234,56" e "1234.56" — nunca confunde separador decimal com
 * separador de milhar: só trata "," como decimal quando ela aparece depois do último ".". */
function parseValorMonetario(texto: string): number | null {
  let limpo = texto.trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (!limpo) return null;
  const negativoComParenteses = /^\(.*\)$/.test(limpo);
  if (negativoComParenteses) limpo = limpo.slice(1, -1);

  const ultimaVirgula = limpo.lastIndexOf(",");
  const ultimoPonto = limpo.lastIndexOf(".");
  if (ultimaVirgula > ultimoPonto) {
    // vírgula é o separador decimal — remove "." de milhar, troca "," por "."
    limpo = limpo.replace(/\./g, "").replace(",", ".");
  } else if (ultimoPonto > ultimaVirgula) {
    // ponto é o separador decimal — remove "," de milhar
    limpo = limpo.replace(/,/g, "");
  }

  const num = Number(limpo);
  if (Number.isNaN(num)) return null;
  return negativoComParenteses ? -Math.abs(num) : num;
}

/** Aceita "DD/MM/AAAA", "DD-MM-AAAA" e "AAAA-MM-DD" — devolve sempre "AAAA-MM-DD", ou null se
 * não reconhecer o formato. */
function parseDataFlexivel(texto: string): string | null {
  const s = texto.trim();
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return s;

  const brMatch = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (brMatch) {
    const [, dia, mes, ano] = brMatch;
    return `${ano}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
  }

  return null;
}

export function parseCsvExtrato(conteudo: string): ResultadoParseCsv {
  const linhas: LinhaExtratoPessoal[] = [];
  const erros: string[] = [];

  const linhasBrutas = conteudo.split(/\r\n|\r|\n/).filter((l) => l.trim() !== "");
  if (linhasBrutas.length === 0) return { linhas: [], erros: ["Arquivo vazio."] };

  const delimitador = detectarDelimitador(linhasBrutas[0]);
  const cabecalho = parseLinhaCsv(linhasBrutas[0], delimitador).map(normalizarCabecalho);

  const idxData = cabecalho.findIndex((h) => ALIASES_DATA.includes(h));
  const idxDescricao = cabecalho.findIndex((h) => ALIASES_DESCRICAO.includes(h));
  const idxValor = cabecalho.findIndex((h) => ALIASES_VALOR.includes(h));
  const idxDebito = cabecalho.findIndex((h) => ALIASES_DEBITO.includes(h));
  const idxCredito = cabecalho.findIndex((h) => ALIASES_CREDITO.includes(h));

  if (idxData === -1) return { linhas: [], erros: ['Não encontrei uma coluna de data (ex: "Data").'] };
  if (idxDescricao === -1) return { linhas: [], erros: ['Não encontrei uma coluna de descrição (ex: "Descrição" ou "Histórico").'] };
  if (idxValor === -1 && idxDebito === -1 && idxCredito === -1) {
    return { linhas: [], erros: ['Não encontrei coluna de valor (ex: "Valor", ou "Débito"/"Crédito" separados).'] };
  }

  for (let i = 1; i < linhasBrutas.length; i++) {
    const numeroLinha = i + 1;
    const campos = parseLinhaCsv(linhasBrutas[i], delimitador);
    if (campos.every((c) => c === "")) continue;

    const dataTexto = campos[idxData] ?? "";
    const descricao = campos[idxDescricao] ?? "";
    const data = parseDataFlexivel(dataTexto);
    if (!data) {
      erros.push(`Linha ${numeroLinha}: data "${dataTexto}" não reconhecida — pulei essa linha.`);
      continue;
    }
    if (!descricao) {
      erros.push(`Linha ${numeroLinha}: sem descrição — pulei essa linha.`);
      continue;
    }

    let valor: number | null = null;
    let tipo: "Receita" | "Despesa" | null = null;

    if (idxValor !== -1 && campos[idxValor]?.trim()) {
      const bruto = parseValorMonetario(campos[idxValor]);
      if (bruto != null) {
        valor = Math.abs(bruto);
        tipo = bruto < 0 ? "Despesa" : "Receita";
      }
    } else {
      const debito = idxDebito !== -1 ? parseValorMonetario(campos[idxDebito] ?? "") : null;
      const credito = idxCredito !== -1 ? parseValorMonetario(campos[idxCredito] ?? "") : null;
      if (debito != null && debito !== 0) {
        valor = Math.abs(debito);
        tipo = "Despesa";
      } else if (credito != null && credito !== 0) {
        valor = Math.abs(credito);
        tipo = "Receita";
      }
    }

    if (valor == null || tipo == null || valor === 0) {
      erros.push(`Linha ${numeroLinha}: não consegui ler um valor válido — pulei essa linha.`);
      continue;
    }

    linhas.push({ data, descricao, valor, tipo });
  }

  return { linhas, erros };
}

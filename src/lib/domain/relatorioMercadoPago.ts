/**
 * Leitura do relatório "Dinheiro em conta" (settlement_report) do Mercado Pago. Puro e sem
 * rede: recebe o texto do CSV e devolve os movimentos de SAÍDA que o endpoint de pagamentos
 * não mostra. Nomes de coluna e valores de TRANSACTION_TYPE seguem o glossário oficial:
 * https://www.mercadopago.com.co/developers/en/docs/reports/account-money/report-fields
 */

export interface MovimentoRelatorio {
  mpId: string;
  data: string; // "AAAA-MM-DD"
  valor: number; // sempre positivo
  tipo: "Receita" | "Despesa";
  descricao: string;
  contraparte: string | null;
  tipoBruto: string;
}

export interface ResultadoRelatorio {
  movimentos: MovimentoRelatorio[];
  contagemPorTipo: Record<string, number>;
  colunasAusentes: string[];
}

/** TRANSACTION_TYPE → o que vira no sistema. SETTLEMENT (pagamento recebido) é ignorado aqui:
 * as entradas já chegam pelo endpoint de pagamentos, com nome/descrição melhores. */
const TIPOS: Record<string, { tipo: "Receita" | "Despesa"; rotulo: string }> = {
  WITHDRAWAL: { tipo: "Despesa", rotulo: "Transferência para banco" },
  PAYOUT: { tipo: "Despesa", rotulo: "Saque" },
  REFUND: { tipo: "Despesa", rotulo: "Reembolso" },
  CHARGEBACK: { tipo: "Despesa", rotulo: "Chargeback" },
  DISPUTE: { tipo: "Despesa", rotulo: "Disputa" },
  WITHDRAWAL_CANCEL: { tipo: "Receita", rotulo: "Transferência cancelada (valor devolvido)" },
};

export function normalizarCabecalho(h: string): string {
  return h
    .replace(/^﻿/, "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** CSV simples com aspas; o separador (";" "," ou tab) é descoberto pela primeira linha. */
export function parseCsv(texto: string): string[][] {
  const limpo = texto.replace(/^﻿/, "");
  const primeira = limpo.split(/\r?\n/, 1)[0] ?? "";
  const contagem = { ";": 0, ",": 0, "\t": 0 };
  for (const c of primeira) if (c in contagem) contagem[c as keyof typeof contagem] += 1;
  const sep = (Object.entries(contagem).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ",") as string;

  const linhas: string[][] = [];
  let campo = "";
  let linha: string[] = [];
  let aspas = false;
  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i];
    if (aspas) {
      if (c === '"' && limpo[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) {
      linha.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && limpo[i + 1] === "\n") i++;
      linha.push(campo);
      campo = "";
      if (linha.some((x) => x.trim() !== "")) linhas.push(linha);
      linha = [];
    } else campo += c;
  }
  linha.push(campo);
  if (linha.some((x) => x.trim() !== "")) linhas.push(linha);
  return linhas;
}

/** "1234.56", "1.234,56", "-1234,56" → número. */
export function parseValor(s: string | undefined): number {
  if (!s) return 0;
  let t = s.trim().replace(/[^\d,.\-]/g, "");
  if (!t) return 0;
  const virgula = t.lastIndexOf(",");
  const ponto = t.lastIndexOf(".");
  if (virgula > -1 && ponto > -1) {
    t = virgula > ponto ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  } else if (virgula > -1) {
    t = t.replace(",", ".");
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

/** Aceita "2026-10-06T10:00:00.000-04:00", "2026-10-06" e "06/10/2026 10:00". */
export function normalizarData(s: string | undefined): string | null {
  const t = s?.trim();
  if (!t) return null;
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
}

const OBRIGATORIAS = ["SOURCE_ID", "TRANSACTION_TYPE"];
const COLUNAS_VALOR = ["SETTLEMENT_NET_AMOUNT", "TRANSACTION_AMOUNT", "REAL_AMOUNT"];
const COLUNAS_DATA = ["TRANSACTION_DATE", "SETTLEMENT_DATE", "TRANSACTION_DATE_SHORT", "SETTLEMENT_DATE_SHORT"];

export function interpretarRelatorio(csv: string): ResultadoRelatorio {
  const linhas = parseCsv(csv);
  if (linhas.length === 0) return { movimentos: [], contagemPorTipo: {}, colunasAusentes: [...OBRIGATORIAS] };

  const cabecalho = linhas[0].map(normalizarCabecalho);
  const idx = (nome: string) => cabecalho.indexOf(nome);
  const primeiroIdx = (nomes: string[]) => nomes.map(idx).find((i) => i >= 0) ?? -1;

  const colunasAusentes = OBRIGATORIAS.filter((n) => idx(n) < 0);
  if (primeiroIdx(COLUNAS_VALOR) < 0) colunasAusentes.push("SETTLEMENT_NET_AMOUNT");
  if (primeiroIdx(COLUNAS_DATA) < 0) colunasAusentes.push("TRANSACTION_DATE");
  if (colunasAusentes.length > 0) return { movimentos: [], contagemPorTipo: {}, colunasAusentes };

  const iSource = idx("SOURCE_ID");
  const iTipo = idx("TRANSACTION_TYPE");
  const iDescricao = idx("DESCRIPTION");
  const iBanco = idx("POI_BANK_NAME");
  const valores = COLUNAS_VALOR.map(idx).filter((i) => i >= 0);
  const datas = COLUNAS_DATA.map(idx).filter((i) => i >= 0);

  const movimentos: MovimentoRelatorio[] = [];
  const contagemPorTipo: Record<string, number> = {};

  for (const linha of linhas.slice(1)) {
    const tipoBruto = (linha[iTipo] ?? "").trim().toUpperCase();
    if (!tipoBruto) continue;
    contagemPorTipo[tipoBruto] = (contagemPorTipo[tipoBruto] ?? 0) + 1;

    const regra = TIPOS[tipoBruto];
    if (!regra) continue;

    const sourceId = (linha[iSource] ?? "").trim();
    if (!sourceId) continue;
    const valor = Math.abs(valores.map((i) => parseValor(linha[i])).find((v) => v !== 0) ?? 0);
    const data = datas.map((i) => normalizarData(linha[i])).find((d) => d !== null) ?? null;
    if (valor === 0 || !data) continue;

    const detalhe = iDescricao >= 0 ? (linha[iDescricao] ?? "").trim() : "";
    const banco = iBanco >= 0 ? (linha[iBanco] ?? "").trim() : "";
    movimentos.push({
      mpId: `${sourceId}:${tipoBruto}`,
      data,
      valor,
      tipo: regra.tipo,
      descricao: detalhe ? `${regra.rotulo} — ${detalhe}` : regra.rotulo,
      contraparte: banco || null,
      tipoBruto,
    });
  }

  return { movimentos, contagemPorTipo, colunasAusentes: [] };
}

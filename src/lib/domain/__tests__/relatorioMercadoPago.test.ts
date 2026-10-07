import { describe, expect, it } from "vitest";
import {
  interpretarRelatorio,
  normalizarCabecalho,
  normalizarData,
  parseCsv,
  parseValor,
} from "../relatorioMercadoPago";

const CSV = [
  "SOURCE_ID;TRANSACTION_TYPE;TRANSACTION_DATE;SETTLEMENT_NET_AMOUNT;TRANSACTION_AMOUNT;DESCRIPTION;POI_BANK_NAME",
  "111;SETTLEMENT;2026-10-06T10:00:00.000-04:00;3900.00;4000.00;Consultorio;",
  '222;WITHDRAWAL;2026-10-07T09:30:00.000-04:00;-1500,50;-1500,50;"Pix; fornecedor ""X""";Banco Inter',
  "333;PAYOUT;2026-10-07T11:00:00.000-04:00;-200.00;-200.00;;",
  "444;WITHDRAWAL_CANCEL;2026-10-08T08:00:00.000-04:00;1500.50;1500.50;;",
  "555;ALGO_NOVO;2026-10-08T08:00:00.000-04:00;10.00;10.00;;",
].join("\n");

describe("parseValor / normalizarData / normalizarCabecalho", () => {
  it("entende formatos brasileiro e americano", () => {
    expect(parseValor("1234.56")).toBe(1234.56);
    expect(parseValor("1.234,56")).toBe(1234.56);
    expect(parseValor("-1500,50")).toBe(-1500.5);
    expect(parseValor("")).toBe(0);
    expect(parseValor("R$ 2,00")).toBe(2);
  });

  it("normaliza datas ISO e BR", () => {
    expect(normalizarData("2026-10-06T10:00:00.000-04:00")).toBe("2026-10-06");
    expect(normalizarData("06/10/2026 10:00")).toBe("2026-10-06");
    expect(normalizarData("lixo")).toBeNull();
  });

  it("cabeçalho tolera espaço, caixa e BOM", () => {
    expect(normalizarCabecalho("﻿Source ID")).toBe("SOURCE_ID");
    expect(normalizarCabecalho(" transaction-type ")).toBe("TRANSACTION_TYPE");
  });
});

describe("parseCsv", () => {
  it("respeita aspas, separador dentro do campo e aspas duplas", () => {
    const linhas = parseCsv(CSV);
    expect(linhas).toHaveLength(6);
    expect(linhas[2][5]).toBe('Pix; fornecedor "X"');
  });

  it("descobre vírgula como separador", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("interpretarRelatorio", () => {
  const r = interpretarRelatorio(CSV);

  it("ignora SETTLEMENT (entradas vêm do endpoint de pagamentos) e tipos desconhecidos", () => {
    expect(r.movimentos.map((m) => m.mpId)).toEqual(["222:WITHDRAWAL", "333:PAYOUT", "444:WITHDRAWAL_CANCEL"]);
  });

  it("conta todos os tipos, inclusive os que não importa, pra diagnóstico", () => {
    expect(r.contagemPorTipo).toEqual({ SETTLEMENT: 1, WITHDRAWAL: 1, PAYOUT: 1, WITHDRAWAL_CANCEL: 1, ALGO_NOVO: 1 });
  });

  it("saída vira Despesa com valor positivo; transferência cancelada vira Receita", () => {
    const saque = r.movimentos[0];
    expect(saque).toMatchObject({ tipo: "Despesa", valor: 1500.5, data: "2026-10-07", contraparte: "Banco Inter" });
    expect(saque.descricao).toContain('fornecedor "X"');
    expect(r.movimentos[2]).toMatchObject({ tipo: "Receita", valor: 1500.5 });
  });

  it("sem descrição usa só o rótulo do tipo", () => {
    expect(r.movimentos[1].descricao).toBe("Saque");
  });

  it("avisa quais colunas obrigatórias faltam em vez de adivinhar", () => {
    const sem = interpretarRelatorio("Data da transação;Valor\n06/10/2026;10,00");
    expect(sem.movimentos).toHaveLength(0);
    expect(sem.colunasAusentes).toEqual(expect.arrayContaining(["SOURCE_ID", "TRANSACTION_TYPE"]));
  });

  it("arquivo vazio não quebra", () => {
    expect(interpretarRelatorio("").movimentos).toEqual([]);
  });
});

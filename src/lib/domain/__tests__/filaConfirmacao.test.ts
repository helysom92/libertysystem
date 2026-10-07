import { describe, expect, it } from "vitest";
import { classificarMovimentos, deslocarISO, type MovimentoSincronizado } from "../filaConfirmacao";
import type { RegraLancamento } from "../regras";
import type { Lancamento } from "../types";

function mov(p: Partial<MovimentoSincronizado> & { id: string }): MovimentoSincronizado {
  return {
    data: "2026-10-06",
    descricao: "Pagamento",
    contraparte: null,
    valor: 100,
    tipo: "Receita",
    conciliado: false,
    ignorado_em: null,
    ...p,
  };
}

function lanc(p: Partial<Lancamento> & { id: string }): Lancamento {
  return {
    tipo: "Receita",
    descricao: "x",
    categoria: "Geral",
    valor: 100,
    data: "2026-10-06",
    servico_id: null,
    fornecedor_id: null,
    banco: null,
    forma_pagamento: null,
    status: "realizado",
    ...p,
  };
}

const lupa: RegraLancamento = {
  id: "r1",
  padrao: "Agência Lupa",
  tipo: "Receita",
  categoria: "Mídia",
  unidade_negocio: "digital",
  recorrencia: "mensal",
  valor_tipico: 1500,
  ativo: true,
  criado_em: "2026-10-01T00:00:00Z",
};

describe("classificarMovimentos", () => {
  it("o que já bate com um lançamento realizado não entra na fila", () => {
    const r = classificarMovimentos([mov({ id: "m1" })], [lanc({ id: "l1", data: "2026-10-04" })], [], "");
    expect(r.itens).toHaveLength(0);
    expect(r.jaLancados).toBe(1);
  });

  it("um lançamento realizado só cobre um movimento (o segundo igual continua pendente)", () => {
    const r = classificarMovimentos([mov({ id: "m1" }), mov({ id: "m2" })], [lanc({ id: "l1" })], [], "");
    expect(r.itens.map((i) => i.movimento.id)).toEqual(["m2"]);
  });

  it("saída que bate com despesa PREVISTA sugere dar baixa, não lançar novo", () => {
    const boleto = lanc({ id: "b1", tipo: "Despesa", status: "previsto", valor: 320, data: "2026-10-10", descricao: "Boleto gráfica" });
    const r = classificarMovimentos([mov({ id: "m1", tipo: "Despesa", valor: 320, data: "2026-10-08" })], [boleto], [], "");
    expect(r.itens).toHaveLength(1);
    expect(r.itens[0].baixas.map((l) => l.id)).toEqual(["b1"]);
  });

  it("previsto fora da janela de 7 dias não é sugerido", () => {
    const boleto = lanc({ id: "b1", tipo: "Despesa", status: "previsto", valor: 320, data: "2026-10-25" });
    const r = classificarMovimentos([mov({ id: "m1", tipo: "Despesa", valor: 320, data: "2026-10-08" })], [boleto], [], "");
    expect(r.itens[0].baixas).toHaveLength(0);
  });

  it("lançamento cancelado é ignorado", () => {
    const r = classificarMovimentos([mov({ id: "m1" })], [lanc({ id: "l1", status: "cancelado" })], [], "");
    expect(r.itens).toHaveLength(1);
    expect(r.jaLancados).toBe(0);
  });

  it("aplica a regra aprendida: categoria e unidade já vêm sugeridas", () => {
    const r = classificarMovimentos([mov({ id: "m1", contraparte: "AGENCIA LUPA LTDA", valor: 1500 })], [], [lupa], "");
    expect(r.itens[0].regra?.id).toBe("r1");
    expect(r.itens[0].categoriaSugerida).toBe("Mídia");
    expect(r.itens[0].unidadeSugerida).toBe("digital");
  });

  it("sem regra: categoria Geral e sem unidade", () => {
    const r = classificarMovimentos([mov({ id: "m1" })], [], [lupa], "");
    expect(r.itens[0].categoriaSugerida).toBe("Geral");
    expect(r.itens[0].unidadeSugerida).toBeNull();
  });

  it("ignora movimentos já conciliados, ignorados ou internos", () => {
    const r = classificarMovimentos(
      [
        mov({ id: "a", conciliado: true }),
        mov({ id: "b", ignorado_em: "2026-10-07T00:00:00Z" }),
        mov({ id: "c", descricao: "Transferência Helysom Barbosa" }),
        mov({ id: "d", valor: 55 }),
      ],
      [],
      [],
      "Helysom Barbosa"
    );
    expect(r.itens.map((i) => i.movimento.id)).toEqual(["d"]);
  });
});

describe("deslocarISO", () => {
  it("anda dias pra frente e pra trás atravessando o mês", () => {
    expect(deslocarISO("2026-10-02", -5)).toBe("2026-09-27");
    expect(deslocarISO("2026-12-30", 3)).toBe("2027-01-02");
  });
});

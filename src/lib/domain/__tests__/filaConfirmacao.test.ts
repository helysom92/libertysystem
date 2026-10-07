import { describe, expect, it } from "vitest";
import { classificarMovimentos, deslocarISO, type MovimentoSincronizado } from "../filaConfirmacao";
import type { RegraLancamento } from "../regras";
import type { Lancamento, ServicoParcela } from "../types";

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

describe("classificarMovimentos — cruzamento com recebimentos previstos", () => {
  const servico = (id: string, extra: Record<string, unknown> = {}) =>
    ({ id, numero: `OS-${id}`, cliente: "Cliente", cliente_id: `cli-${id}`, financeiro_status: "Pendente", ...extra }) as never;

  const parcela = (id: string, servicoId: string, p: Record<string, unknown> = {}): ServicoParcela =>
    ({
      id,
      servico_id: servicoId,
      ordem: 1,
      descricao: "Restante (50%)",
      valor_previsto: 1900,
      data_prevista: "2026-08-28",
      valor_pago: null,
      pago_em: null,
      forma_pagamento: null,
      lancamento_id: null,
      cancelada_em: null,
      cancelada_por: null,
      motivo_cancelamento: null,
      ...p,
    }) as ServicoParcela;

  const entrada = (id: string, valor: number, extra: Partial<MovimentoSincronizado> = {}) =>
    mov({ id, valor, tipo: "Receita", ...extra });

  it("Pix com o mesmo valor do saldo de uma parcela em aberto pergunta se corresponde", () => {
    const r = classificarMovimentos([entrada("m1", 1900)], [], [], "", {
      parcelas: [parcela("p1", "1")],
      servicos: [servico("1")],
    });
    expect(r.itens[0].recebiveis).toEqual([
      expect.objectContaining({ parcelaId: "p1", servicoId: "1", saldo: 1900, motivo: "valor igual" }),
    ]);
  });

  it("usa o SALDO (parcela parcialmente paga), não o valor previsto inteiro", () => {
    const r = classificarMovimentos([entrada("m1", 1400)], [], [], "", {
      parcelas: [parcela("p1", "1", { valor_pago: 500 })],
      servicos: [servico("1")],
    });
    expect(r.itens[0].recebiveis[0]).toMatchObject({ parcelaId: "p1", saldo: 1400 });
  });

  it("parcela cancelada ou de OS cancelada não é oferecida", () => {
    const r = classificarMovimentos([entrada("m1", 1900)], [], [], "", {
      parcelas: [parcela("p1", "1", { cancelada_em: "2026-09-01T00:00:00Z" }), parcela("p2", "2")],
      servicos: [servico("1"), servico("2", { financeiro_status: "Cancelado" })],
    });
    expect(r.itens[0].recebiveis).toHaveLength(0);
  });

  it("dois Pix iguais e uma parcela só: a parcela vai pro primeiro", () => {
    const r = classificarMovimentos(
      [entrada("m1", 1900, { data: "2026-10-05" }), entrada("m2", 1900, { data: "2026-10-06" })],
      [],
      [],
      "",
      { parcelas: [parcela("p1", "1")], servicos: [servico("1")] }
    );
    expect(r.itens.map((i) => i.recebiveis.length)).toEqual([1, 0]);
  });

  it("lançamento previsto que pertence a uma parcela NÃO vira baixa direta", () => {
    const previstoDaParcela = lanc({ id: "lp", tipo: "Receita", status: "previsto", valor: 1900, data: "2026-10-04" });
    const r = classificarMovimentos([entrada("m1", 1900)], [previstoDaParcela], [], "", {
      parcelas: [parcela("p1", "1", { lancamento_id: "lp" })],
      servicos: [servico("1")],
    });
    expect(r.itens[0].baixas).toHaveLength(0);
    expect(r.itens[0].recebiveis).toHaveLength(1);
  });

  it("pagador identificado pelo CNPJ: sugere o cliente e as parcelas dele, mesmo com valor diferente", () => {
    const r = classificarMovimentos(
      [entrada("m1", 600, { pagador: { nome: null, banco: "Sicredi", documento: "12345678000190", tipoDocumento: "CNPJ", email: null } })],
      [],
      [],
      "",
      {
        parcelas: [parcela("p1", "1", { valor_previsto: 1000 }), parcela("p2", "2", { valor_previsto: 1000 })],
        servicos: [servico("1", { cliente_id: "cli-dm" }), servico("2", { cliente_id: "outro" })],
        clientes: [
          { id: "cli-dm", nome: "Daverson Matos", empresa: "DM Eventos", cpf_cnpj: "12.345.678/0001-90" },
          { id: "outro", nome: "Outro Cliente", empresa: null, cpf_cnpj: null },
        ],
      }
    );
    expect(r.itens[0].clientesProvaveis[0]).toMatchObject({ clienteId: "cli-dm", motivo: "CPF/CNPJ confere" });
    expect(r.itens[0].recebiveis.map((c) => [c.parcelaId, c.motivo])).toEqual([["p1", "mesmo cliente"]]);
  });

  it("o banco do pagador nunca é usado pra achar cliente", () => {
    const r = classificarMovimentos(
      [entrada("m1", 77, { descricao: "Pix recebido", pagador: { nome: null, banco: "Cooperativa Sicredi Centro", documento: null, tipoDocumento: null, email: null } })],
      [],
      [],
      "",
      {
        parcelas: [],
        servicos: [],
        clientes: [{ id: "c", nome: "Cooperativa Sicredi Centro", empresa: null, cpf_cnpj: null }],
      }
    );
    expect(r.itens[0].clientesProvaveis).toHaveLength(0);
  });

  it("saída (despesa) nunca recebe sugestão de recebível", () => {
    const r = classificarMovimentos([mov({ id: "m1", tipo: "Despesa", valor: 1900 })], [], [], "", {
      parcelas: [parcela("p1", "1")],
      servicos: [servico("1")],
    });
    expect(r.itens[0].recebiveis).toHaveLength(0);
  });
});

describe("deslocarISO", () => {
  it("anda dias pra frente e pra trás atravessando o mês", () => {
    expect(deslocarISO("2026-10-02", -5)).toBe("2026-09-27");
    expect(deslocarISO("2026-12-30", 3)).toBe("2027-01-02");
  });
});

import { describe, expect, it } from "vitest";
import {
  calcularFaturaDaCompra,
  gerarParcelasCompra,
  vencimentoDaFatura,
  totalFaturaAberta,
  limiteUsado,
  limiteDisponivel,
  situacaoFatura,
  saldoDivida,
  parcelasRestantesAtual,
  situacaoDividaVencimento,
  saldoConta,
  saldoInvestimento,
  totalAportadoInvestimento,
  totalInvestidoGeral,
  rendimentoTotalInvestimento,
} from "../financasPessoais";
import type {
  CartaoPessoal,
  CompraCartaoPessoal,
  ContaPessoal,
  DespesaPessoal,
  DividaPessoal,
  InvestimentoPessoal,
  MovimentoInvestimentoPessoal,
  PagamentoDividaPessoal,
} from "../types";

function compra(over: Partial<CompraCartaoPessoal>): CompraCartaoPessoal {
  return {
    id: "c1",
    owner_id: "o1",
    cartao_id: "cartao1",
    compra_grupo_id: "g1",
    descricao: "Compra",
    categoria: null,
    valor_parcela: 100,
    numero_parcela: 1,
    parcelas_total: 1,
    data_compra: "2026-08-10",
    fatura_ano: 2026,
    fatura_mes: 8,
    criado_em: "2026-08-10T00:00:00Z",
    cancelada_em: null,
    cancelada_por: null,
    motivo_cancelamento: null,
    ...over,
  };
}

function cartao(over: Partial<CartaoPessoal>): CartaoPessoal {
  return {
    id: "cartao1",
    owner_id: "o1",
    nome: "Cartão Teste",
    banco: null,
    dia_fechamento: 20,
    dia_vencimento: 27,
    limite: 1000,
    ativo: true,
    criado_em: "2026-01-01T00:00:00Z",
    ...over,
  };
}

function despesa(over: Partial<DespesaPessoal>): DespesaPessoal {
  return {
    id: "d1",
    owner_id: "o1",
    descricao: "Fatura",
    categoria: null,
    favorecido: null,
    valor_previsto: 100,
    valor_pago: 0,
    conta_id: null,
    vencimento: null,
    data_efetiva: null,
    recorrencia: "unica",
    situacao: "prevista",
    observacoes: null,
    cancelada_em: null,
    motivo_cancelamento: null,
    cartao_id: null,
    fatura_ano: null,
    fatura_mes: null,
    ...over,
  };
}

function divida(over: Partial<DividaPessoal>): DividaPessoal {
  return {
    id: "div1",
    owner_id: "o1",
    credor: "Banco X",
    descricao: null,
    saldo_inicial: 1000,
    valor_parcela: 100,
    parcelas_restantes_inicial: 10,
    dia_vencimento: 10,
    taxa_juros_mensal: null,
    situacao: "ativa",
    observacoes: null,
    quitada_em: null,
    criado_em: "2026-01-01T00:00:00Z",
    ...over,
  };
}

function pagamentoDivida(over: Partial<PagamentoDividaPessoal>): PagamentoDividaPessoal {
  return {
    id: "p1",
    owner_id: "o1",
    divida_id: "div1",
    valor: 100,
    data: "2026-08-10",
    conta_id: null,
    criado_em: "2026-08-10T00:00:00Z",
    estornado_em: null,
    estornado_por: null,
    motivo_estorno: null,
    ...over,
  };
}

describe("calcularFaturaDaCompra", () => {
  it("compra até o dia de fechamento entra na fatura do mesmo mês", () => {
    expect(calcularFaturaDaCompra("2026-08-20", 20)).toEqual({ ano: 2026, mes: 8 });
  });

  it("compra depois do fechamento rola pra fatura do mês seguinte", () => {
    expect(calcularFaturaDaCompra("2026-08-21", 20)).toEqual({ ano: 2026, mes: 9 });
  });

  it("rolagem de dezembro pra janeiro vira o ano", () => {
    expect(calcularFaturaDaCompra("2026-12-25", 20)).toEqual({ ano: 2027, mes: 1 });
  });
});

describe("gerarParcelasCompra", () => {
  it("divide em parcelas iguais quando o valor é exato", () => {
    const parcelas = gerarParcelasCompra("2026-08-10", 20, 300, 3);
    expect(parcelas).toEqual([
      { numero: 1, valor: 100, ano: 2026, mes: 8 },
      { numero: 2, valor: 100, ano: 2026, mes: 9 },
      { numero: 3, valor: 100, ano: 2026, mes: 10 },
    ]);
  });

  it("joga o resto de centavos na última parcela — soma bate exatamente com o total", () => {
    const parcelas = gerarParcelasCompra("2026-08-10", 20, 100, 3);
    const soma = parcelas.reduce((s, p) => s + p.valor, 0);
    expect(Math.round(soma * 100) / 100).toBe(100);
    expect(parcelas[0].valor).toBe(33.33);
    expect(parcelas[1].valor).toBe(33.33);
    expect(parcelas[2].valor).toBe(33.34);
  });

  it("parcela única cai só na fatura calculada, sem gerar mês extra", () => {
    const parcelas = gerarParcelasCompra("2026-08-10", 20, 50, 1);
    expect(parcelas).toEqual([{ numero: 1, valor: 50, ano: 2026, mes: 8 }]);
  });
});

describe("vencimentoDaFatura", () => {
  it("vencimento depois do fechamento no mesmo mês", () => {
    expect(vencimentoDaFatura(2026, 8, 5, 15)).toBe("2026-08-15");
  });

  it("vencimento antes do fechamento (padrão comum) rola pro mês seguinte", () => {
    expect(vencimentoDaFatura(2026, 8, 20, 5)).toBe("2026-09-05");
  });

  it("rolagem de dezembro vira o ano", () => {
    expect(vencimentoDaFatura(2026, 12, 20, 5)).toBe("2027-01-05");
  });
});

describe("totalFaturaAberta / limiteUsado / limiteDisponivel", () => {
  const compras = [
    compra({ id: "c1", valor_parcela: 100, fatura_ano: 2026, fatura_mes: 8 }),
    compra({ id: "c2", valor_parcela: 50, fatura_ano: 2026, fatura_mes: 8 }),
    compra({ id: "c3", valor_parcela: 30, fatura_ano: 2026, fatura_mes: 9 }),
    compra({ id: "c4", valor_parcela: 999, fatura_ano: 2026, fatura_mes: 8, cancelada_em: "2026-08-11T00:00:00Z" }),
  ];

  it("soma só as parcelas não canceladas da fatura pedida", () => {
    expect(totalFaturaAberta(compras, "cartao1", 2026, 8)).toBe(150);
    expect(totalFaturaAberta(compras, "cartao1", 2026, 9)).toBe(30);
  });

  it("limite usado soma todas as faturas não pagas, ignora canceladas", () => {
    expect(limiteUsado("cartao1", compras, new Set())).toBe(180);
  });

  it("uma fatura paga libera o limite dela, mas não das outras", () => {
    expect(limiteUsado("cartao1", compras, new Set(["2026-08"]))).toBe(30);
  });

  it("limite disponível é null quando o cartão não tem limite cadastrado", () => {
    expect(limiteDisponivel(cartao({ limite: null }), 100)).toBeNull();
  });

  it("limite disponível é limite menos usado, pode ficar negativo (estourou)", () => {
    expect(limiteDisponivel(cartao({ limite: 1000 }), 1200)).toBe(-200);
  });
});

describe("situacaoFatura", () => {
  it("sem despesa vinculada e sem compras é 'sem_compras'", () => {
    expect(situacaoFatura(null, 0)).toBe("sem_compras");
  });

  it("sem despesa vinculada mas com compras é 'nao_lancada'", () => {
    expect(situacaoFatura(null, 150)).toBe("nao_lancada");
  });

  it("com despesa vinculada reflete a situação real da despesa, nunca um status inventado", () => {
    expect(situacaoFatura(despesa({ situacao: "paga" }), 150)).toBe("paga");
    expect(situacaoFatura(despesa({ situacao: "parcial" }), 150)).toBe("parcial");
  });
});

describe("saldoDivida / parcelasRestantesAtual", () => {
  const d = divida({ saldo_inicial: 1000, parcelas_restantes_inicial: 10 });

  it("sem pagamento nenhum, saldo é o saldo inicial cadastrado", () => {
    expect(saldoDivida(d, [])).toBe(1000);
    expect(parcelasRestantesAtual(d, [])).toBe(10);
  });

  it("desconta só pagamentos não estornados dessa dívida", () => {
    const pagamentos = [
      pagamentoDivida({ id: "p1", divida_id: "div1", valor: 100 }),
      pagamentoDivida({ id: "p2", divida_id: "div1", valor: 100, estornado_em: "2026-08-15T00:00:00Z" }),
      pagamentoDivida({ id: "p3", divida_id: "outra-divida", valor: 500 }),
    ];
    expect(saldoDivida(d, pagamentos)).toBe(900);
    expect(parcelasRestantesAtual(d, pagamentos)).toBe(9);
  });

  it("nunca fica negativo mesmo se os pagamentos somarem mais que o saldo inicial (dado inconsistente)", () => {
    const pagamentos = [pagamentoDivida({ valor: 1500 })];
    expect(saldoDivida(d, pagamentos)).toBe(0);
  });

  it("parcelas restantes null quando a dívida não tem essa informação cadastrada", () => {
    expect(parcelasRestantesAtual(divida({ parcelas_restantes_inicial: null }), [])).toBeNull();
  });
});

describe("situacaoDividaVencimento", () => {
  it("dívida quitada é sempre 'quitada', independente de vencimento", () => {
    expect(situacaoDividaVencimento(divida({ situacao: "quitada" }), [], "2026-08-15")).toBe("quitada");
  });

  it("sem dia de vencimento cadastrado é 'sem_vencimento'", () => {
    expect(situacaoDividaVencimento(divida({ dia_vencimento: null }), [], "2026-08-15")).toBe("sem_vencimento");
  });

  it("já pagou esse mês é 'em_dia', mesmo que o dia já tenha passado", () => {
    const d = divida({ dia_vencimento: 5 });
    const pagamentos = [pagamentoDivida({ divida_id: "div1", data: "2026-08-03" })];
    expect(situacaoDividaVencimento(d, pagamentos, "2026-08-15")).toBe("em_dia");
  });

  it("não pagou esse mês e o dia já passou é 'vencida'", () => {
    const d = divida({ dia_vencimento: 5 });
    expect(situacaoDividaVencimento(d, [], "2026-08-15")).toBe("vencida");
  });

  it("não pagou esse mês mas o dia ainda não chegou é 'a_vencer'", () => {
    const d = divida({ dia_vencimento: 20 });
    expect(situacaoDividaVencimento(d, [], "2026-08-15")).toBe("a_vencer");
  });

  it("um pagamento estornado não conta como 'pagou esse mês'", () => {
    const d = divida({ dia_vencimento: 5 });
    const pagamentos = [pagamentoDivida({ divida_id: "div1", data: "2026-08-03", estornado_em: "2026-08-04T00:00:00Z" })];
    expect(situacaoDividaVencimento(d, pagamentos, "2026-08-15")).toBe("vencida");
  });
});

// ── Bloco D: investimentos ──────────────────────────────────────────────────────────────────

function conta(over: Partial<ContaPessoal>): ContaPessoal {
  return {
    id: "conta1",
    owner_id: "o1",
    nome: "Conta Corrente",
    instituicao: null,
    tipo: null,
    saldo_inicial: 1000,
    data_saldo_inicial: "2026-08-01",
    ativa: true,
    ...over,
  };
}

function investimento(over: Partial<InvestimentoPessoal>): InvestimentoPessoal {
  return {
    id: "inv1",
    owner_id: "o1",
    nome: "Tesouro Selic",
    tipo: "Renda fixa",
    instituicao: null,
    ativo: true,
    criado_em: "2026-01-01T00:00:00Z",
    ...over,
  };
}

function movimento(over: Partial<MovimentoInvestimentoPessoal>): MovimentoInvestimentoPessoal {
  return {
    id: "m1",
    owner_id: "o1",
    investimento_id: "inv1",
    tipo: "aporte",
    valor: 100,
    data: "2026-08-10",
    conta_id: null,
    criado_em: "2026-08-10T00:00:00Z",
    estornado_em: null,
    estornado_por: null,
    motivo_estorno: null,
    ...over,
  };
}

describe("saldoInvestimento / totalAportadoInvestimento / rendimentoTotalInvestimento", () => {
  const movimentos = [
    movimento({ id: "m1", investimento_id: "inv1", tipo: "aporte", valor: 1000 }),
    movimento({ id: "m2", investimento_id: "inv1", tipo: "rendimento", valor: 50 }),
    movimento({ id: "m3", investimento_id: "inv1", tipo: "resgate", valor: 200 }),
    movimento({ id: "m4", investimento_id: "inv1", tipo: "aporte", valor: 999, estornado_em: "2026-08-11T00:00:00Z" }),
    movimento({ id: "m5", investimento_id: "outro-investimento", tipo: "aporte", valor: 5000 }),
  ];

  it("saldo é aporte + rendimento - resgate, ignora estornados e outros investimentos", () => {
    expect(saldoInvestimento(investimento({}), movimentos)).toBe(850);
  });

  it("total aportado soma só aportes não estornados, nunca resgate/rendimento", () => {
    expect(totalAportadoInvestimento(investimento({}), movimentos)).toBe(1000);
  });

  it("rendimento total soma só os rendimentos não estornados", () => {
    expect(rendimentoTotalInvestimento(investimento({}), movimentos)).toBe(50);
  });
});

describe("totalInvestidoGeral", () => {
  it("soma só investimentos ativos, ignora desativados", () => {
    const investimentos = [
      investimento({ id: "a", ativo: true }),
      investimento({ id: "b", ativo: true }),
      investimento({ id: "c", ativo: false }),
    ];
    const movimentos = [
      movimento({ investimento_id: "a", tipo: "aporte", valor: 1000 }),
      movimento({ investimento_id: "b", tipo: "aporte", valor: 500 }),
      movimento({ investimento_id: "c", tipo: "aporte", valor: 9999 }),
    ];
    expect(totalInvestidoGeral(investimentos, movimentos)).toBe(1500);
  });
});

describe("saldoConta com movimentos de investimento", () => {
  it("aporte tira da conta, resgate devolve pra conta", () => {
    const c = conta({ saldo_inicial: 1000, data_saldo_inicial: "2026-08-01" });
    const movimentos = [
      movimento({ tipo: "aporte", valor: 300, conta_id: "conta1", data: "2026-08-10" }),
      movimento({ tipo: "resgate", valor: 100, conta_id: "conta1", data: "2026-08-15" }),
    ];
    expect(saldoConta(c, [], [], [], movimentos)).toBe(800); // 1000 - 300 + 100
  });

  it("rendimento nunca mexe na conta, mesmo com conta_id preenchido por engano", () => {
    const c = conta({ saldo_inicial: 1000, data_saldo_inicial: "2026-08-01" });
    const movimentos = [movimento({ tipo: "rendimento", valor: 50, conta_id: "conta1", data: "2026-08-10" })];
    expect(saldoConta(c, [], [], [], movimentos)).toBe(1000);
  });

  it("movimento estornado não conta pro saldo da conta", () => {
    const c = conta({ saldo_inicial: 1000, data_saldo_inicial: "2026-08-01" });
    const movimentos = [
      movimento({ tipo: "aporte", valor: 300, conta_id: "conta1", data: "2026-08-10", estornado_em: "2026-08-11T00:00:00Z" }),
    ];
    expect(saldoConta(c, [], [], [], movimentos)).toBe(1000);
  });

  it("movimento de outra conta não afeta o saldo desta", () => {
    const c = conta({ id: "conta1", saldo_inicial: 1000, data_saldo_inicial: "2026-08-01" });
    const movimentos = [movimento({ tipo: "aporte", valor: 300, conta_id: "outra-conta", data: "2026-08-10" })];
    expect(saldoConta(c, [], [], [], movimentos)).toBe(1000);
  });

  it("sem 5º argumento continua funcionando como antes (compatibilidade)", () => {
    const c = conta({ saldo_inicial: 1000, data_saldo_inicial: "2026-08-01" });
    expect(saldoConta(c, [], [], [])).toBe(1000);
  });
});

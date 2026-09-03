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
  totalFaturasEmAberto,
  patrimonioLiquido,
  ehDuplicataMovimentoPessoal,
  normalizarDescricaoPessoal,
  compromissosProximos,
  receitasProximas,
  receitasAtrasadas,
  despesasAtrasadas,
  alertasPessoais,
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
  ReceitaPessoal,
} from "../types";

function receita(over: Partial<ReceitaPessoal>): ReceitaPessoal {
  return {
    id: "r1",
    owner_id: "o1",
    descricao: "Salário",
    origem_id: null,
    pagador: null,
    categoria: null,
    valor_previsto: 1000,
    valor_recebido: 0,
    conta_destino_id: null,
    data_prevista: null,
    data_efetiva: null,
    recorrencia: "unica",
    situacao: "prevista",
    observacoes: null,
    cancelada_em: null,
    motivo_cancelamento: null,
    ...over,
  };
}

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

describe("totalFaturasEmAberto / patrimonioLiquido (Bloco F)", () => {
  const cartaoAtivo = cartao({ id: "cartaoA", ativo: true });
  const cartaoInativo = cartao({ id: "cartaoB", ativo: false });

  it("soma compras não canceladas de faturas não pagas em todos os cartões ativos, ignora inativos", () => {
    const compras = [
      compra({ id: "c1", cartao_id: "cartaoA", valor_parcela: 100, fatura_ano: 2026, fatura_mes: 9 }),
      compra({ id: "c2", cartao_id: "cartaoA", valor_parcela: 50, fatura_ano: 2026, fatura_mes: 10 }),
      compra({ id: "c3", cartao_id: "cartaoB", valor_parcela: 999, fatura_ano: 2026, fatura_mes: 9 }),
    ];
    expect(totalFaturasEmAberto([cartaoAtivo, cartaoInativo], compras, [])).toBe(150);
  });

  it("uma fatura já paga (despesa vinculada com situação paga) sai do total em aberto", () => {
    const compras = [compra({ id: "c1", cartao_id: "cartaoA", valor_parcela: 100, fatura_ano: 2026, fatura_mes: 9 })];
    const despesas = [
      despesa({ cartao_id: "cartaoA", fatura_ano: 2026, fatura_mes: 9, situacao: "paga" }),
    ];
    expect(totalFaturasEmAberto([cartaoAtivo], compras, despesas)).toBe(0);
  });

  it("patrimônio líquido soma o que é seu e subtrai o que você deve", () => {
    expect(patrimonioLiquido(1000, 500, 300, 100)).toBe(1100);
  });

  it("patrimônio líquido pode ficar negativo se as dívidas superarem os ativos", () => {
    expect(patrimonioLiquido(100, 0, 500, 0)).toBe(-400);
  });
});

describe("Etapa 7.1 — proteção contra importação duplicada", () => {
  it("mesmo valor e mesma descrição (mesma grafia) é duplicata", () => {
    expect(
      ehDuplicataMovimentoPessoal({ valor: 150.75, descricao: "Supermercado ABC" }, { valor: 150.75, descricao: "Supermercado ABC" })
    ).toBe(true);
  });

  it("importar o mesmo extrato duas vezes gera a mesma linha duas vezes — detectado", () => {
    // Simula a mesma linha do extrato lida duas vezes (dois uploads do mesmo arquivo).
    const linhaDoExtrato = { valor: 89.9, descricao: "NETFLIX.COM" };
    expect(ehDuplicataMovimentoPessoal(linhaDoExtrato, { ...linhaDoExtrato })).toBe(true);
  });

  it("descrição com acento/maiúscula/espaço a mais ainda é reconhecida como igual", () => {
    expect(
      ehDuplicataMovimentoPessoal({ valor: 50, descricao: "  Padaria São José  " }, { valor: 50, descricao: "padaria sao jose" })
    ).toBe(true);
  });

  it("diferença de até 1 centavo (arredondamento) ainda conta como igual", () => {
    expect(ehDuplicataMovimentoPessoal({ valor: 100.0, descricao: "Farmácia" }, { valor: 100.004, descricao: "Farmácia" })).toBe(
      true
    );
  });

  it("valor genuinamente diferente NÃO é duplicata — mesmo com descrição igual", () => {
    expect(ehDuplicataMovimentoPessoal({ valor: 100, descricao: "Uber" }, { valor: 35, descricao: "Uber" })).toBe(false);
  });

  it("descrição genuinamente diferente NÃO é duplicata — mesmo com valor igual", () => {
    expect(ehDuplicataMovimentoPessoal({ valor: 100, descricao: "Uber" }, { valor: 100, descricao: "iFood" })).toBe(false);
  });

  it("duas transações genuinamente idênticas no mesmo dia (ex: 2 corridas de Uber de R$20) são marcadas como possível duplicata — mas o fluxo de confirmação (Server Action) permite registrar mesmo assim, nunca bloqueia de vez", () => {
    // A função pura só aponta "parece igual" — quem decide se é duplicata de verdade ou uma
    // repetição legítima é o usuário, via confirmarDuplicata=true na Server Action.
    expect(ehDuplicataMovimentoPessoal({ valor: 20, descricao: "Uber" }, { valor: 20, descricao: "Uber" })).toBe(true);
  });

  it("normalizarDescricaoPessoal remove acento, caixa e espaços nas pontas", () => {
    expect(normalizarDescricaoPessoal("  Ônibus Intermunicipal  ")).toBe("onibus intermunicipal");
  });
});

describe("Etapa 7.3 — compromissos/receitas próximos (janela móvel, não o mês calendário)", () => {
  const HOJE = "2026-08-27";

  it("despesa vencendo dentro dos próximos 7 dias aparece, ordenada por vencimento", () => {
    const d1 = despesa({ id: "d1", vencimento: "2026-09-01", valor_previsto: 200 });
    const d2 = despesa({ id: "d2", vencimento: "2026-08-28", valor_previsto: 50 });
    const r = compromissosProximos([d1, d2], HOJE);
    expect(r.map((x) => x.id)).toEqual(["d2", "d1"]);
  });

  it("despesa vencendo além de 7 dias não aparece", () => {
    const d = despesa({ vencimento: "2026-09-10", valor_previsto: 100 });
    expect(compromissosProximos([d], HOJE)).toEqual([]);
  });

  it("despesa vencendo antes de hoje (já atrasada) não conta como 'próxima' — isso já é 'vencido'", () => {
    const d = despesa({ vencimento: "2026-08-20", valor_previsto: 100 });
    expect(compromissosProximos([d], HOJE)).toEqual([]);
  });

  it("despesa já paga ou cancelada não aparece mesmo com vencimento próximo", () => {
    const paga = despesa({ vencimento: "2026-08-28", valor_previsto: 100, valor_pago: 100, situacao: "paga" });
    const cancelada = despesa({ id: "d2", vencimento: "2026-08-28", valor_previsto: 100, situacao: "cancelada" });
    expect(compromissosProximos([paga, cancelada], HOJE)).toEqual([]);
  });

  it("despesa parcialmente paga mostra só o saldo restante", () => {
    const d = despesa({ vencimento: "2026-08-28", valor_previsto: 300, valor_pago: 100, situacao: "parcial" });
    expect(compromissosProximos([d], HOJE)[0].valor).toBe(200);
  });

  it("receitasProximas espelha o mesmo critério pro lado da receita", () => {
    const r1 = receita({ id: "r1", data_prevista: "2026-08-30", valor_previsto: 500 });
    const r2 = receita({ id: "r2", data_prevista: "2026-09-15", valor_previsto: 500 });
    const resultado = receitasProximas([r1, r2], HOJE);
    expect(resultado.map((x) => x.id)).toEqual(["r1"]);
  });
});

describe("Etapa 8 — central de alertas pessoais (só lê, nunca age sozinha)", () => {
  const HOJE = "2026-08-27";

  it("receitasAtrasadas ignora escopo de mês — pega qualquer previsão vencida", () => {
    const r = receita({ data_prevista: "2026-06-01", valor_previsto: 300 });
    expect(receitasAtrasadas([r], HOJE)).toHaveLength(1);
  });

  it("receitasAtrasadas não conta receita já recebida ou cancelada", () => {
    const recebida = receita({ data_prevista: "2026-06-01", valor_previsto: 300, valor_recebido: 300, situacao: "recebida" });
    const cancelada = receita({ id: "r2", data_prevista: "2026-06-01", valor_previsto: 300, situacao: "cancelada" });
    expect(receitasAtrasadas([recebida, cancelada], HOJE)).toEqual([]);
  });

  it("despesasAtrasadas espelha receitasAtrasadas pro lado da despesa (achado do review: faltava)", () => {
    const atrasada = despesa({ vencimento: "2026-06-01", valor_previsto: 150 });
    const paga = despesa({ id: "d2", vencimento: "2026-06-01", valor_previsto: 150, valor_pago: 150, situacao: "paga" });
    const resultado = despesasAtrasadas([atrasada, paga], HOJE);
    expect(resultado).toHaveLength(1);
    expect(resultado[0].id).toBe("d1");
  });

  it("alertasPessoais junta despesa próxima + receita atrasada + fatura vencendo + dívida vencida", () => {
    const despesaProxima = despesa({ vencimento: "2026-08-28", valor_previsto: 100 });
    const receitaAtrasada = receitasAtrasadas([receita({ data_prevista: "2026-08-01", valor_previsto: 200 })], HOJE);
    const cartaoTeste = cartao({ id: "c1", dia_fechamento: 20, dia_vencimento: 28 });
    const compraTeste = compra({ cartao_id: "c1", fatura_ano: 2026, fatura_mes: 8, valor_parcela: 150 });
    const dividaVencida = divida({ dia_vencimento: 10, situacao: "ativa" });

    const alertas = alertasPessoais([despesaProxima], receitaAtrasada, [cartaoTeste], [compraTeste], [dividaVencida], [], HOJE);

    expect(alertas.some((a) => a.texto.includes("Despesa pessoal vencendo"))).toBe(true);
    expect(alertas.some((a) => a.texto.includes("Receita esperada atrasada"))).toBe(true);
    expect(alertas.some((a) => a.texto.includes("Fatura"))).toBe(true);
    expect(alertas.some((a) => a.texto.includes("Dívida"))).toBe(true);
  });

  it("alertasPessoais também avisa despesa pessoal já atrasada, não só a próxima de vencer", () => {
    const despesaAtrasada = despesa({ vencimento: "2026-08-01", valor_previsto: 80 });
    const alertas = alertasPessoais([despesaAtrasada], [], [], [], [], [], HOJE);
    expect(alertas.some((a) => a.texto.includes("Despesa pessoal atrasada"))).toBe(true);
  });

  it("alertasPessoais não avisa fatura sem nenhuma compra no mês", () => {
    const cartaoTeste = cartao({ id: "c1", dia_fechamento: 20, dia_vencimento: 28 });
    const alertas = alertasPessoais([], [], [cartaoTeste], [], [], [], HOJE);
    expect(alertas.some((a) => a.texto.includes("Fatura"))).toBe(false);
  });

  it("alertasPessoais não avisa dívida já quitada", () => {
    const dividaQuitada = divida({ dia_vencimento: 10, situacao: "quitada" });
    const alertas = alertasPessoais([], [], [], [], [dividaQuitada], [], HOJE);
    expect(alertas.some((a) => a.texto.includes("Dívida"))).toBe(false);
  });

  it("tudo em dia (sem nada pendente) devolve lista vazia", () => {
    expect(alertasPessoais([], [], [], [], [], [], HOJE)).toEqual([]);
  });
});

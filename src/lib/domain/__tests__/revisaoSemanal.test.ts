import { describe, expect, it } from "vitest";
import { fimDaSemana, inicioDaSemana, montarRevisao, resumoDaRevisao, type DadosRevisao } from "../revisaoSemanal";
import type { DespesaFixa, Lancamento, Servico, ServicoParcela } from "../types";

function os(p: Partial<Servico> & { id: string }): Servico {
  return {
    numero: "OS-1",
    cliente: "Cliente",
    valor: 1000,
    valor_pago: 0,
    prazo: null,
    concluido: false,
    financeiro_status: "Pendente",
    perdido_em: null,
    proposta_enviada_em: null,
    data_follow_up: null,
    ...p,
  } as unknown as Servico;
}

function lanc(p: Partial<Lancamento> & { id: string }): Lancamento {
  return {
    tipo: "Despesa",
    descricao: "Lançamento",
    categoria: "Geral",
    valor: 100,
    data: "2026-10-07",
    servico_id: null,
    fornecedor_id: null,
    banco: null,
    forma_pagamento: null,
    status: "previsto",
    ...p,
  };
}

function dados(p: Partial<DadosRevisao> = {}): DadosRevisao {
  return {
    hojeISO: "2026-10-07", // quarta-feira
    servicos: [],
    lancamentos: [],
    servicoParcelas: [],
    despesasFixas: [],
    despesasFixasOcorrencias: [],
    despesasVariaveis: [],
    despesasVariaveisOcorrencias: [],
    ...p,
  };
}

describe("inicioDaSemana / fimDaSemana", () => {
  it("devolve a segunda-feira da semana", () => {
    expect(inicioDaSemana("2026-10-05")).toBe("2026-10-05"); // segunda
    expect(inicioDaSemana("2026-10-07")).toBe("2026-10-05"); // quarta
    expect(inicioDaSemana("2026-10-11")).toBe("2026-10-05"); // domingo fecha a semana
    expect(inicioDaSemana("2026-10-04")).toBe("2026-09-28"); // domingo anterior
  });

  it("atravessa virada de mês e de ano", () => {
    expect(inicioDaSemana("2027-01-01")).toBe("2026-12-28");
    expect(fimDaSemana("2026-12-30")).toBe("2027-01-03");
  });
});

describe("montarRevisao — entregas", () => {
  it("separa atrasada, da semana e fora da janela; ignora orçamento e OS concluída", () => {
    const r = montarRevisao(
      dados({
        servicos: [
          os({ id: "atrasada", prazo: "2026-10-06" }),
          os({ id: "hoje", prazo: "2026-10-07" }),
          os({ id: "limite", prazo: "2026-10-13" }),
          os({ id: "depois", prazo: "2026-10-14" }),
          os({ id: "orcamento", numero: null, prazo: "2026-10-08" }),
          os({ id: "concluida", prazo: "2026-10-08", concluido: true }),
        ],
      })
    );
    expect(r.entregas.atrasadas.map((i) => i.id)).toEqual(["atrasada"]);
    expect(r.entregas.proximas.map((i) => i.id)).toEqual(["hoje", "limite"]);
  });
});

describe("montarRevisao — contas a pagar", () => {
  it("lançamento previsto: vencido, da semana ou fora da janela", () => {
    const r = montarRevisao(
      dados({
        lancamentos: [
          lanc({ id: "venceu", data: "2026-10-03" }),
          lanc({ id: "semana", data: "2026-10-10" }),
          lanc({ id: "longe", data: "2026-10-30" }),
          lanc({ id: "pago", data: "2026-10-08", status: "realizado" }),
        ],
      })
    );
    expect(r.pagar.vencidas.map((i) => i.id)).toEqual(["venceu"]);
    expect(r.pagar.proximas.map((i) => i.id)).toEqual(["semana"]);
  });

  it("despesa fixa não paga com vencimento na semana entra; a já paga não", () => {
    const fixa = (id: string, dia: number): DespesaFixa => ({
      id,
      descricao: `Fixa ${id}`,
      valor: 200,
      dia_vencimento: dia,
      categoria: null,
      fornecedor_id: null,
      ativo: true,
    });
    const r = montarRevisao(
      dados({
        despesasFixas: [fixa("aluguel", 9), fixa("internet", 8)],
        despesasFixasOcorrencias: [
          {
            id: "o1",
            despesa_fixa_id: "internet",
            ano: 2026,
            mes: 10,
            pago: true,
            pago_em: null,
            lancamento_id: null,
            cancelada_em: null,
            cancelada_por: null,
            motivo_cancelamento: null,
            valor_pago: 200,
          },
        ],
      })
    );
    expect(r.pagar.proximas.map((i) => i.id)).toEqual(["aluguel"]);
  });

  it("janela que cruza o mês enxerga o vencimento do mês seguinte", () => {
    const r = montarRevisao(
      dados({
        hojeISO: "2026-10-28",
        despesasFixas: [
          { id: "luz", descricao: "Luz", valor: 300, dia_vencimento: 2, categoria: null, fornecedor_id: null, ativo: true },
        ],
      })
    );
    expect(r.pagar.proximas.map((i) => [i.id, i.data])).toContainEqual(["luz", "2026-11-02"]);
  });
});

describe("montarRevisao — recebimentos, fluxo e previsão", () => {
  const parcela = (p: Partial<ServicoParcela> & { id: string }): ServicoParcela => ({
    servico_id: "s1",
    ordem: 1,
    descricao: "Parcela",
    valor_previsto: 500,
    data_prevista: "2026-10-06",
    valor_pago: null,
    pago_em: null,
    forma_pagamento: null,
    lancamento_id: null,
    cancelada_em: null,
    cancelada_por: null,
    motivo_cancelamento: null,
    ...p,
  });

  it("parcela em atraso mostra só o saldo; cancelada não conta", () => {
    const r = montarRevisao(
      dados({
        servicos: [os({ id: "s1", numero: "OS-9" })],
        servicoParcelas: [
          parcela({ id: "p1", valor_pago: 100 }),
          parcela({ id: "p2", cancelada_em: "2026-10-01T00:00:00Z" }),
          parcela({ id: "p3", data_prevista: "2026-10-09", valor_previsto: 700 }),
        ],
      })
    );
    expect(r.receber.atrasadas.map((i) => [i.id, i.valor])).toEqual([["p1", 400]]);
    expect(r.receber.proximas.map((i) => [i.id, i.valor])).toEqual([["p3", 700]]);
  });

  it("fluxo da semana anterior conta só realizado de segunda a domingo passados", () => {
    const r = montarRevisao(
      dados({
        lancamentos: [
          lanc({ id: "e1", tipo: "Receita", data: "2026-09-28", valor: 1000, status: "realizado" }),
          lanc({ id: "e2", tipo: "Receita", data: "2026-10-04", valor: 500, status: "realizado" }),
          lanc({ id: "fora", tipo: "Receita", data: "2026-10-05", valor: 9999, status: "realizado" }),
          lanc({ id: "prev", tipo: "Receita", data: "2026-10-01", valor: 9999, status: "previsto" }),
          lanc({ id: "s1", tipo: "Despesa", data: "2026-10-02", valor: 400, status: "realizado" }),
        ],
      })
    );
    expect(r.fluxoSemanaAnterior).toMatchObject({
      inicio: "2026-09-28",
      fim: "2026-10-04",
      recebido: 1500,
      pago: 400,
      resultado: 1100,
      qtdRecebido: 2,
      qtdPago: 1,
    });
  });

  it("previsão dos 7 dias = o que entra menos o que sai", () => {
    const r = montarRevisao(
      dados({
        lancamentos: [
          lanc({ id: "in", tipo: "Receita", data: "2026-10-09", valor: 1500 }),
          lanc({ id: "out", tipo: "Despesa", data: "2026-10-10", valor: 400 }),
        ],
      })
    );
    expect(r.previsao).toEqual({ entra: 1500, sai: 400, saldo: 1100 });
  });
});

describe("resumoDaRevisao", () => {
  it("guarda contagens e totais de cada seção", () => {
    const r = montarRevisao(
      dados({
        servicos: [os({ id: "a", prazo: "2026-10-01" })],
        lancamentos: [lanc({ id: "d", data: "2026-10-02", valor: 250 })],
      })
    );
    const resumo = resumoDaRevisao(r, 3);
    expect(resumo.banco.pendentes).toBe(3);
    expect(resumo.entregas.atrasadas).toBe(1);
    expect(resumo.pagar.vencidas).toEqual({ quantidade: 1, total: 250 });
    expect(r.semanaInicio).toBe("2026-10-05");
  });
});

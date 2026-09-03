import { describe, expect, it } from "vitest";
import {
  alertasComerciais,
  aprovadosNoMes,
  orcamentosDoMes,
  perdidosNoMes,
  propostasAguardandoResposta,
  propostasEnviadasNoMes,
  propostasSemFollowUp,
  propostasVencidas,
  taxaConversao,
  ticketMedioAprovado,
} from "../comercial";
import { periodoDoMes } from "../financas";
import type { Servico } from "../types";

function servico(overrides: Partial<Servico> = {}): Servico {
  return {
    id: "s1",
    numero: null,
    aprovado_em: null,
    cliente_id: "c1",
    cliente: "Cliente Teste",
    descricao: "Serviço teste",
    valor: 1000,
    valor_pago: 0,
    tipo: "criacao",
    estagio: "Digitação",
    coluna_id: "col1",
    concluido: false,
    prazo: null,
    prazo_tipo: null,
    prazo_inicio: null,
    informacoes_adicionais: null,
    local_instalacao: null,
    criado_em: "2026-08-05T10:00:00Z",
    concluido_em: null,
    responsavel: "",
    prioridade: "Normal",
    financeiro_status: "Orçado",
    entrega_confirmada: false,
    liberado_admin: false,
    proxima_acao_texto: null,
    proxima_responsavel: null,
    proxima_prazo: null,
    motivo_espera: null,
    capa_foto_id: null,
    linha_orcamento: null,
    validade_proposta_dias: 7,
    forma_pagamento_texto: null,
    durabilidade_texto: null,
    share_token: null,
    proposta_opcao_escolhida: null,
    proposta_escolhida_em: null,
    origem_lead: null,
    data_follow_up: null,
    proposta_enviada_em: null,
    motivo_perda: null,
    perdido_em: null,
    ...overrides,
  };
}

const AGOSTO = periodoDoMes(2026, 8);

describe("orcamentosDoMes", () => {
  it("conta pela data de CRIAÇÃO, independente do desfecho depois", () => {
    const svs = [
      servico({ id: "a", criado_em: "2026-08-01T10:00:00Z", valor: 500 }),
      servico({ id: "b", criado_em: "2026-08-31T23:00:00Z", numero: "OS-1", valor: 700 }),
      servico({ id: "c", criado_em: "2026-07-31T10:00:00Z", valor: 300 }),
    ];
    const r = orcamentosDoMes(svs, AGOSTO);
    expect(r.quantidade).toBe(2);
    expect(r.total).toBe(1200);
  });
});

describe("propostasEnviadasNoMes", () => {
  it("só conta quem tem proposta_enviada_em no mês", () => {
    const svs = [
      servico({ id: "a", proposta_enviada_em: "2026-08-10T10:00:00Z", valor: 500 }),
      servico({ id: "b", proposta_enviada_em: null }),
      servico({ id: "c", proposta_enviada_em: "2026-07-10T10:00:00Z" }),
    ];
    const r = propostasEnviadasNoMes(svs, AGOSTO);
    expect(r.quantidade).toBe(1);
    expect(r.total).toBe(500);
  });
});

describe("aprovadosNoMes", () => {
  it("delega pra vendasAprovadas (mesma regra oficial do Financeiro)", () => {
    const svs = [
      servico({ id: "a", numero: "OS-1", aprovado_em: "2026-08-15T10:00:00Z", valor: 1000 }),
      servico({ id: "b", numero: "OS-2", aprovado_em: "2026-08-20T10:00:00Z", valor: 500, financeiro_status: "Cancelado" }),
    ];
    const r = aprovadosNoMes(svs, AGOSTO);
    expect(r.quantidade).toBe(1);
    expect(r.total).toBe(1000);
  });
});

describe("perdidosNoMes", () => {
  it("conta pela data de perda", () => {
    const svs = [
      servico({ id: "a", perdido_em: "2026-08-05T10:00:00Z", motivo_perda: "Preço", valor: 300 }),
      servico({ id: "b", perdido_em: "2026-07-05T10:00:00Z" }),
    ];
    const r = perdidosNoMes(svs, AGOSTO);
    expect(r.quantidade).toBe(1);
    expect(r.total).toBe(300);
  });
});

describe("taxaConversao", () => {
  it("aprovados / (aprovados + perdidos)", () => {
    expect(taxaConversao(3, 1)).toBe(0.75);
  });
  it("0 quando não há nenhum desfecho ainda (não confundir com 0%)", () => {
    expect(taxaConversao(0, 0)).toBe(0);
  });
});

describe("ticketMedioAprovado", () => {
  it("total / quantidade", () => {
    expect(ticketMedioAprovado({ total: 3000, quantidade: 3, registros: [] })).toBe(1000);
  });
  it("0 sem nenhum aprovado (evita divisão por zero)", () => {
    expect(ticketMedioAprovado({ total: 0, quantidade: 0, registros: [] })).toBe(0);
  });
});

describe("propostasAguardandoResposta", () => {
  it("só oportunidades abertas com proposta já enviada", () => {
    const svs = [
      servico({ id: "a", proposta_enviada_em: "2026-08-01T10:00:00Z" }),
      servico({ id: "b", proposta_enviada_em: null }),
      servico({ id: "c", proposta_enviada_em: "2026-08-01T10:00:00Z", numero: "OS-1" }),
      servico({ id: "d", proposta_enviada_em: "2026-08-01T10:00:00Z", perdido_em: "2026-08-02T10:00:00Z" }),
    ];
    const r = propostasAguardandoResposta(svs);
    expect(r.map((x) => x.id)).toEqual(["a"]);
  });
});

describe("propostasSemFollowUp", () => {
  it("dentro das aguardando resposta, só quem não tem data_follow_up", () => {
    const svs = [
      servico({ id: "a", proposta_enviada_em: "2026-08-01T10:00:00Z", data_follow_up: null }),
      servico({ id: "b", proposta_enviada_em: "2026-08-01T10:00:00Z", data_follow_up: "2026-08-10" }),
    ];
    const r = propostasSemFollowUp(svs);
    expect(r.map((x) => x.id)).toEqual(["a"]);
  });
});

describe("propostasVencidas", () => {
  it("vencida quando hoje já passou de enviada + validade_proposta_dias", () => {
    const svs = [
      servico({ id: "a", proposta_enviada_em: "2026-08-01T10:00:00Z", validade_proposta_dias: 7 }),
    ];
    expect(propostasVencidas(svs, "2026-08-09").map((x) => x.id)).toEqual(["a"]);
    expect(propostasVencidas(svs, "2026-08-08").map((x) => x.id)).toEqual([]);
  });

  it("achado do review: proposta enviada tarde da noite (fuso MS) não conta como enviada no dia seguinte por causa do UTC", () => {
    // 21h30 de 10/08 em Campo Grande (UTC-4) grava como 2026-08-11T01:30:00Z. Vencimento real
    // (fuso da operação): 10/08 + 7 dias = 17/08. Um bug de `.slice(0,10)` direto no timestamp
    // leria a data como "2026-08-11" e empurraria o vencimento pra 18/08 — em 18/08 a proposta
    // já devia estar vencida (17/08 < 18/08); com o bug, ainda pareceria válida.
    const svs = [
      servico({ id: "a", proposta_enviada_em: "2026-08-11T01:30:00Z", validade_proposta_dias: 7 }),
    ];
    expect(propostasVencidas(svs, "2026-08-18").map((x) => x.id)).toEqual(["a"]);
  });
});

describe("alertasComerciais", () => {
  const hoje = "2026-08-15";

  it("follow-up vencido gera alerta", () => {
    const svs = [servico({ data_follow_up: "2026-08-10", proposta_enviada_em: "2026-08-01T10:00:00Z" })];
    const alertas = alertasComerciais(svs, hoje);
    expect(alertas.some((a) => a.texto.includes("follow-up vencido"))).toBe(true);
  });

  it("orçamento parado sem proposta enviada gera alerta após o limiar de dias", () => {
    const svs = [servico({ criado_em: "2026-08-01T10:00:00Z", proposta_enviada_em: null })];
    const alertas = alertasComerciais(svs, hoje);
    expect(alertas.some((a) => a.texto.includes("parado"))).toBe(true);
  });

  it("orçamento recente sem proposta enviada não gera alerta de parado", () => {
    const svs = [servico({ criado_em: "2026-08-14T10:00:00Z", proposta_enviada_em: null })];
    const alertas = alertasComerciais(svs, hoje);
    expect(alertas.some((a) => a.texto.includes("parado"))).toBe(false);
  });

  it("proposta vencida gera alerta", () => {
    const svs = [servico({ proposta_enviada_em: "2026-08-01T10:00:00Z", validade_proposta_dias: 7, data_follow_up: "2026-08-05" })];
    const alertas = alertasComerciais(svs, hoje);
    expect(alertas.some((a) => a.texto.includes("vencida"))).toBe(true);
  });

  it("proposta perto de vencer (dentro do limiar) gera alerta de aviso, não de vencida", () => {
    const svs = [servico({ proposta_enviada_em: "2026-08-10T10:00:00Z", validade_proposta_dias: 7, data_follow_up: "2026-08-05" })];
    const alertas = alertasComerciais(svs, hoje);
    expect(alertas.some((a) => a.texto.includes("vence em"))).toBe(true);
  });

  it("proposta enviada sem follow-up agendado gera alerta próprio", () => {
    const svs = [servico({ proposta_enviada_em: "2026-08-10T10:00:00Z", validade_proposta_dias: 30, data_follow_up: null })];
    const alertas = alertasComerciais(svs, hoje);
    expect(alertas.some((a) => a.texto.includes("sem follow-up agendado"))).toBe(true);
  });

  it("oportunidade já aprovada nunca gera alerta comercial", () => {
    const svs = [
      servico({ numero: "OS-1", criado_em: "2026-07-01T10:00:00Z", proposta_enviada_em: "2026-07-01T10:00:00Z", validade_proposta_dias: 1, data_follow_up: "2026-07-02" }),
    ];
    expect(alertasComerciais(svs, hoje)).toEqual([]);
  });

  it("oportunidade já perdida nunca gera alerta comercial", () => {
    const svs = [
      servico({ perdido_em: "2026-08-01T10:00:00Z", criado_em: "2026-07-01T10:00:00Z", proposta_enviada_em: null }),
    ];
    expect(alertasComerciais(svs, hoje)).toEqual([]);
  });

  it("tudo em dia (follow-up recente, dentro da validade) não gera alerta nenhum", () => {
    const svs = [
      servico({
        criado_em: hoje + "T10:00:00Z",
        proposta_enviada_em: hoje + "T10:00:00Z",
        validade_proposta_dias: 30,
        data_follow_up: "2026-08-20",
      }),
    ];
    expect(alertasComerciais(svs, hoje)).toEqual([]);
  });
});

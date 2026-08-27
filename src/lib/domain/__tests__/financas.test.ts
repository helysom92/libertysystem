import { describe, it, expect } from "vitest";
import type {
  Servico,
  Lancamento,
  ServicoParcela,
  DespesaFixa,
  DespesaFixaOcorrencia,
  DespesaVariavel,
  DespesaVariavelOcorrencia,
} from "../types";
import {
  vendasAprovadas,
  recebido,
  despesasPagas,
  aReceber,
  aPagar,
  resultadoRealizado,
  resultadoPendente,
  resultadoPrevistoFinal,
  periodoDoMes,
  excluirPrevistosDeServicoCancelado,
  duplicidadesLancamentos,
  inconsistenciasFinanceiras,
} from "../financas";

function servico(overrides: Partial<Servico> = {}): Servico {
  return {
    id: "sv-1",
    numero: null,
    aprovado_em: null,
    cliente_id: "cli-1",
    cliente: "Cliente Teste",
    descricao: "Serviço teste",
    valor: 1000,
    valor_pago: 0,
    tipo: "simples",
    estagio: "Orçamento",
    coluna_id: null,
    concluido: false,
    prazo: null,
    prazo_tipo: null,
    prazo_inicio: null,
    informacoes_adicionais: null,
    local_instalacao: null,
    criado_em: "2026-08-01T12:00:00Z",
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
    ...overrides,
  };
}

function lancamento(overrides: Partial<Lancamento> = {}): Lancamento {
  return {
    id: "lc-1",
    tipo: "Receita",
    descricao: "Lançamento teste",
    categoria: null,
    valor: 100,
    data: "2026-08-10",
    servico_id: null,
    fornecedor_id: null,
    banco: null,
    forma_pagamento: null,
    status: "realizado",
    ...overrides,
  };
}

function parcela(overrides: Partial<ServicoParcela> = {}): ServicoParcela {
  return {
    id: "pc-1",
    servico_id: "sv-1",
    ordem: 0,
    descricao: "Parcela teste",
    valor_previsto: 100,
    data_prevista: "2026-08-15",
    valor_pago: null,
    pago_em: null,
    forma_pagamento: null,
    lancamento_id: null,
    ...overrides,
  };
}

function despesaFixa(overrides: Partial<DespesaFixa> = {}): DespesaFixa {
  return { id: "df-1", descricao: "Aluguel", valor: 500, dia_vencimento: 10, categoria: null, fornecedor_id: null, ativo: true, ...overrides };
}

function ocorrenciaFixa(overrides: Partial<DespesaFixaOcorrencia> = {}): DespesaFixaOcorrencia {
  return { id: "of-1", despesa_fixa_id: "df-1", ano: 2026, mes: 8, pago: false, pago_em: null, lancamento_id: null, ...overrides };
}

function despesaVariavel(overrides: Partial<DespesaVariavel> = {}): DespesaVariavel {
  return { id: "dv-1", descricao: "Energia", valor_provisionado: 200, categoria: null, fornecedor_id: null, data: null, ativo: true, ...overrides };
}

function ocorrenciaVariavel(overrides: Partial<DespesaVariavelOcorrencia> = {}): DespesaVariavelOcorrencia {
  return { id: "ov-1", despesa_variavel_id: "dv-1", ano: 2026, mes: 8, valor_real: null, pago: false, pago_em: null, lancamento_id: null, ...overrides };
}

const AGOSTO = periodoDoMes(2026, 8);
const HOJE = "2026-08-27";

describe("financas — 25 cenários obrigatórios", () => {
  it("1. OS aprovada dentro do mês conta em vendasAprovadas", () => {
    const s = servico({ numero: "OS-1", aprovado_em: "2026-08-15T12:00:00Z", valor: 1000 });
    const r = vendasAprovadas([s], AGOSTO);
    expect(r.total).toBe(1000);
    expect(r.quantidade).toBe(1);
  });

  it("2. OS criada em julho e aprovada em agosto conta em agosto, não em julho", () => {
    const s = servico({ numero: "OS-2", criado_em: "2026-07-05T12:00:00Z", aprovado_em: "2026-08-02T12:00:00Z", valor: 500 });
    expect(vendasAprovadas([s], periodoDoMes(2026, 7)).total).toBe(0);
    expect(vendasAprovadas([s], AGOSTO).total).toBe(500);
  });

  it("3. Orçamento ainda não aprovado (sem numero) não conta como venda", () => {
    const s = servico({ numero: null, aprovado_em: null, valor: 800 });
    expect(vendasAprovadas([s], AGOSTO).total).toBe(0);
  });

  it("4. OS aprovada mas cancelada não conta como venda", () => {
    const s = servico({ numero: "OS-4", aprovado_em: "2026-08-10T12:00:00Z", financeiro_status: "Cancelado", valor: 900 });
    expect(vendasAprovadas([s], AGOSTO).total).toBe(0);
  });

  it("5. Recebimento total soma o lançamento realizado inteiro", () => {
    const l = lancamento({ tipo: "Receita", status: "realizado", valor: 1000, data: "2026-08-05" });
    expect(recebido([l], AGOSTO).total).toBe(1000);
  });

  it("6. Recebimento parcial deixa só o saldo em aberto (não o valor total da OS)", () => {
    const s = servico({ id: "sv-6", numero: "OS-6", valor: 1000, valor_pago: 400 });
    const p = parcela({ servico_id: "sv-6", valor_previsto: 1000, valor_pago: 400, data_prevista: "2026-08-20" });
    const r = aReceber([s], [p], [], AGOSTO, HOJE);
    expect(r.total).toBe(600);
  });

  it("7. Duas parcelas realizadas em meses diferentes contam cada uma no seu mês", () => {
    const l1 = lancamento({ id: "l7a", status: "realizado", data: "2026-07-28", valor: 500 });
    const l2 = lancamento({ id: "l7b", status: "realizado", data: "2026-08-03", valor: 500 });
    expect(recebido([l1, l2], periodoDoMes(2026, 7)).total).toBe(500);
    expect(recebido([l1, l2], AGOSTO).total).toBe(500);
  });

  it("8. Parcela em aberto (sem pagamento) aparece inteira em a receber", () => {
    const s = servico({ id: "sv-8", numero: "OS-8" });
    const p = parcela({ servico_id: "sv-8", valor_previsto: 300, valor_pago: null, data_prevista: "2026-08-12" });
    expect(aReceber([s], [p], [], AGOSTO, HOJE).total).toBe(300);
  });

  it("9. Parcela com vencimento já passado aparece separadamente em vencidos", () => {
    const s = servico({ id: "sv-9", numero: "OS-9" });
    const p = parcela({ servico_id: "sv-9", valor_previsto: 300, data_prevista: "2026-08-05" });
    const r = aReceber([s], [p], [], AGOSTO, "2026-08-27");
    expect(r.vencidos).toHaveLength(1);
    expect(r.vencidos[0].valor).toBe(300);
  });

  it("10. Despesa paga soma no período certo", () => {
    const l = lancamento({ tipo: "Despesa", status: "realizado", valor: 250, data: "2026-08-09" });
    expect(despesasPagas([l], AGOSTO).total).toBe(250);
  });

  it("11. Despesa parcialmente paga conta só o pago em despesasPagas, o resto em aPagar", () => {
    const pago = lancamento({ id: "l11a", tipo: "Despesa", status: "realizado", valor: 300, data: "2026-08-10" });
    const restante = lancamento({ id: "l11b", tipo: "Despesa", status: "previsto", valor: 200, data: "2026-08-25" });
    expect(despesasPagas([pago, restante], AGOSTO).total).toBe(300);
    expect(aPagar([], [], [], [], [restante], AGOSTO, HOJE).total).toBe(200);
  });

  it("12. Despesa fixa não paga no mês aparece em aPagar", () => {
    const df = despesaFixa({ id: "df-12", valor: 500, dia_vencimento: 10 });
    const oc = ocorrenciaFixa({ despesa_fixa_id: "df-12", ano: 2026, mes: 8, pago: false });
    expect(aPagar([df], [oc], [], [], [], AGOSTO, HOJE).total).toBe(500);
  });

  it("13. Despesa fixa com vencimento passado aparece em vencidos", () => {
    const df = despesaFixa({ id: "df-13", dia_vencimento: 5 });
    const oc = ocorrenciaFixa({ despesa_fixa_id: "df-13", ano: 2026, mes: 8, pago: false });
    const r = aPagar([df], [oc], [], [], [], AGOSTO, "2026-08-27");
    expect(r.vencidos).toHaveLength(1);
  });

  it("14. Lançamento previsto vinculado a serviço cancelado não entra em aPagar", () => {
    const sCancelado = servico({ id: "sv-14", numero: "OS-14", financeiro_status: "Cancelado" });
    const l = lancamento({ id: "l14", tipo: "Despesa", status: "previsto", valor: 150, data: "2026-08-15", servico_id: "sv-14" });
    const validos = excluirPrevistosDeServicoCancelado([l], [sCancelado]);
    expect(aPagar([], [], [], [], validos, AGOSTO, HOJE).total).toBe(0);
  });

  it("15. Despesa recorrente ativa aparece em aPagar", () => {
    const df = despesaFixa({ id: "df-15", ativo: true, valor: 100 });
    const oc = ocorrenciaFixa({ despesa_fixa_id: "df-15", ano: 2026, mes: 8, pago: false });
    expect(aPagar([df], [oc], [], [], [], AGOSTO, HOJE).total).toBe(100);
  });

  it("16. Despesa recorrente desativada não aparece em aPagar mesmo com ocorrência do mês", () => {
    const df = despesaFixa({ id: "df-16", ativo: false, valor: 100 });
    const oc = ocorrenciaFixa({ despesa_fixa_id: "df-16", ano: 2026, mes: 8, pago: false });
    expect(aPagar([df], [oc], [], [], [], AGOSTO, HOJE).total).toBe(0);
  });

  it("17. Consultar a mesma ocorrência de novo não dobra o valor (idempotente)", () => {
    const df = despesaFixa({ id: "df-17" });
    const oc = ocorrenciaFixa({ id: "oc-a", despesa_fixa_id: "df-17", ano: 2026, mes: 8, pago: false });
    const r1 = aPagar([df], [oc], [], [], [], AGOSTO, HOJE);
    const r2 = aPagar([df], [oc], [], [], [], AGOSTO, HOJE);
    expect(r1.total).toBe(r2.total);
    expect(r1.quantidade).toBe(1);
  });

  it("18. Duas cobranças idênticas (simulando duplo-clique) são identificadas como possível duplicidade", () => {
    const a = lancamento({ id: "l18a", descricao: "Aluguel", valor: 500, data: "2026-08-10" });
    const b = lancamento({ id: "l18b", descricao: "Aluguel", valor: 500, data: "2026-08-10" });
    expect(duplicidadesLancamentos([a, b])).toHaveLength(1);
  });

  it("19. Desmarcar pagamento (pago=false) faz a despesa voltar a aparecer em aPagar", () => {
    const df = despesaFixa({ id: "df-19", valor: 400 });
    const ocPago = ocorrenciaFixa({ despesa_fixa_id: "df-19", ano: 2026, mes: 8, pago: true });
    const ocAberto = ocorrenciaFixa({ despesa_fixa_id: "df-19", ano: 2026, mes: 8, pago: false });
    expect(aPagar([df], [ocPago], [], [], [], AGOSTO, HOJE).total).toBe(0);
    expect(aPagar([df], [ocAberto], [], [], [], AGOSTO, HOJE).total).toBe(400);
  });

  it("20. OS numerada sem data de aprovação vira inconsistência — não é ignorada silenciosamente", () => {
    const s = servico({ id: "sv-20", numero: "OS-20", aprovado_em: null });
    const achados = inconsistenciasFinanceiras([s], []);
    expect(achados.some((a) => a.tipo === "aprovado_sem_data" && a.registroId === "sv-20")).toBe(true);
  });

  it("21. Resultado realizado = recebido − despesas pagas", () => {
    expect(resultadoRealizado(1000, 400)).toBe(600);
  });

  it("22. Resultado pendente = a receber − a pagar", () => {
    expect(resultadoPendente(500, 200)).toBe(300);
  });

  it("23. Resultado previsto final soma realizado e pendente sem duplicar", () => {
    expect(resultadoPrevistoFinal(1000, 500, 400, 200)).toBe(900);
  });

  it("24. Soma de registros[] sempre bate com o total apresentado", () => {
    const s1 = servico({ id: "sv-24a", numero: "OS-24a", aprovado_em: "2026-08-05T10:00:00Z", valor: 300 });
    const s2 = servico({ id: "sv-24b", numero: "OS-24b", aprovado_em: "2026-08-20T10:00:00Z", valor: 700 });
    const v = vendasAprovadas([s1, s2], AGOSTO);
    expect(v.registros.reduce((sum, r) => sum + r.valor, 0)).toBe(v.total);

    const l1 = lancamento({ id: "l24a", status: "realizado", valor: 150, data: "2026-08-03" });
    const l2 = lancamento({ id: "l24b", status: "realizado", valor: 250, data: "2026-08-22" });
    const rec = recebido([l1, l2], AGOSTO);
    expect(rec.registros.reduce((sum, r) => sum + r.valor, 0)).toBe(rec.total);
  });

  // 25. "Usuário sem permissão tentando consultar os indicadores" — quem decide isso é
  // `requireRole`/RLS (Server Action, Etapa 1), não estas funções puras (que não têm conceito
  // de sessão por design, pra não duplicar autorização em 2 lugares). O que dá pra garantir
  // AQUI é a metade "não esconder o problema": um dado inconsistente vira uma inconsistência
  // sinalizada, nunca um total mascarado silenciosamente.
  it("25. Saldo negativo (dado inconsistente) vira inconsistência sinalizada, nunca escondida", () => {
    const p = parcela({ id: "pc-25", valor_previsto: 100, valor_pago: 150 });
    const achados = inconsistenciasFinanceiras([], [p]);
    expect(achados.some((a) => a.tipo === "saldo_negativo" && a.registroId === "pc-25")).toBe(true);
  });
});

describe("financas — confirmações extras pedidas", () => {
  it("Nenhum valor contado duas vezes: parcela com lançamento vinculado não soma duas vezes em aReceber", () => {
    const s = servico({ id: "sv-x", numero: "OS-X" });
    const p = parcela({ id: "pc-x", servico_id: "sv-x", valor_previsto: 400, data_prevista: "2026-08-14", lancamento_id: "lc-x" });
    const lVinculado = lancamento({ id: "lc-x", tipo: "Receita", status: "previsto", valor: 400, data: "2026-08-14", servico_id: "sv-x" });
    const r = aReceber([s], [p], [lVinculado], AGOSTO, HOJE);
    expect(r.total).toBe(400);
  });

  it("Filtro mensal respeita corretamente o início e o fim do período", () => {
    const l1 = lancamento({ id: "lb1", status: "realizado", data: "2026-07-31", valor: 100 });
    const l2 = lancamento({ id: "lb2", status: "realizado", data: "2026-08-01", valor: 200 });
    const l3 = lancamento({ id: "lb3", status: "realizado", data: "2026-08-31", valor: 300 });
    const l4 = lancamento({ id: "lb4", status: "realizado", data: "2026-09-01", valor: 400 });
    expect(recebido([l1, l2, l3, l4], AGOSTO).total).toBe(500);
  });

  it("Ticket médio não divide por zero quando não há vendas", () => {
    const r = vendasAprovadas([], AGOSTO);
    expect(r.total).toBe(0);
    expect(r.ticketMedio).toBe(0);
  });

  it("Dinheiro já realizado antes do cancelamento continua contando (decisão confirmada)", () => {
    // Serviço cancelado, mas já tinha um lançamento REALIZADO antes disso — fica de fora de
    // vendasAprovadas (a venda em si não vale mais), mas o dinheiro que já entrou continua em
    // `recebido`, porque `recebido` nunca olha pro financeiro_status do serviço.
    const sCancelado = servico({ id: "sv-canc", numero: "OS-CANC", aprovado_em: "2026-08-05T10:00:00Z", financeiro_status: "Cancelado" });
    const lJaRecebido = lancamento({ id: "l-canc", tipo: "Receita", status: "realizado", valor: 500, data: "2026-08-06", servico_id: "sv-canc" });
    expect(vendasAprovadas([sCancelado], AGOSTO).total).toBe(0);
    expect(recebido([lJaRecebido], AGOSTO).total).toBe(500);
  });

  it("Despesa variável não paga, com valor real editado, usa o valor real (não o provisionado)", () => {
    const dv = despesaVariavel({ id: "dv-x", valor_provisionado: 200 });
    const oc = ocorrenciaVariavel({ despesa_variavel_id: "dv-x", ano: 2026, mes: 8, pago: false, valor_real: 250 });
    const r = aPagar([], [], [dv], [oc], [], AGOSTO, HOJE);
    expect(r.total).toBe(250);
  });
});

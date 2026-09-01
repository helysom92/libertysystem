import { describe, expect, it } from "vitest";
import { pendenciasParaConclusao } from "../pendenciasConclusao";
import type { ChecklistItem, Cliente, Foto, Medicao, Servico, ServicoDetail } from "../types";

function servico(overrides: Partial<Servico> = {}): Servico {
  return {
    id: "s1",
    numero: "OS-1",
    aprovado_em: "2026-08-01T10:00:00Z",
    cliente_id: "c1",
    cliente: "Cliente Teste",
    descricao: "Serviço teste",
    valor: 0,
    valor_pago: 0,
    tipo: "medida_instalacao",
    estagio: "Produção",
    coluna_id: "col1",
    concluido: false,
    prazo: null,
    prazo_tipo: null,
    prazo_inicio: null,
    informacoes_adicionais: null,
    local_instalacao: null,
    criado_em: "2026-08-01T10:00:00Z",
    concluido_em: null,
    responsavel: "",
    prioridade: "Normal",
    financeiro_status: "Não orçado",
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

function cliente(): Cliente {
  return {
    id: "c1",
    nome: "Cliente Teste",
    empresa: null,
    cpf_cnpj: null,
    cidade: null,
    endereco: null,
    whatsapp: null,
    whatsapp_2: null,
    email: null,
    observacoes: null,
    status: "regularizado",
    created_at: "2026-01-01T00:00:00Z",
  };
}

function checklistItem(texto: string, done: boolean): ChecklistItem {
  return { id: texto, servico_id: "s1", texto, done, ordem: 0 };
}

function medida(): Medicao {
  return {
    id: "m1",
    servico_id: "s1",
    largura: 100,
    altura: 100,
    profundidade: null,
    unidade: "cm",
    quantidade: 1,
    local_medicao: null,
    responsavel: null,
    data: "2026-08-01",
    observacoes: null,
    status_revisao: "Confirmada",
  };
}

function foto(): Foto {
  return { id: "f1", servico_id: "s1", slot: 1, storage_path: "x", crop: null };
}

function detail(overrides: Partial<ServicoDetail> = {}): ServicoDetail {
  return {
    servico: servico(),
    cliente: cliente(),
    medidas: [],
    arquivos: [],
    fotos: [],
    checklist: [],
    timeline: [],
    historico: [],
    orcamentoItens: [],
    propostaOpcoes: [],
    eventos: [],
    parcelas: [],
    ...overrides,
  };
}

describe("pendenciasParaConclusao", () => {
  it("serviço já concluído nunca tem pendência (mesmo com tudo faltando)", () => {
    const d = detail({ servico: servico({ concluido: true, entrega_confirmada: false }) });
    expect(pendenciasParaConclusao(d)).toEqual([]);
  });

  it("lista cada item de checklist não concluído", () => {
    const d = detail({
      checklist: [checklistItem("Medida inicial", true), checklistItem("Instalação", false)],
      medidas: [medida()],
      fotos: [foto()],
      servico: servico({ tipo: "criacao", entrega_confirmada: true }),
    });
    const pendencias = pendenciasParaConclusao(d).map((p) => p.texto);
    expect(pendencias).toEqual(["Checklist: Instalação"]);
  });

  it("checklist 100% concluído não gera pendência de checklist", () => {
    const d = detail({
      checklist: [checklistItem("Produção", true)],
      medidas: [medida()],
      fotos: [foto()],
      servico: servico({ tipo: "criacao", entrega_confirmada: true }),
    });
    expect(pendenciasParaConclusao(d)).toEqual([]);
  });

  it("checklist vazio (nenhum item cadastrado) não é tratado como pendência", () => {
    const d = detail({
      checklist: [],
      medidas: [medida()],
      fotos: [foto()],
      servico: servico({ tipo: "criacao", entrega_confirmada: true }),
    });
    expect(pendenciasParaConclusao(d)).toEqual([]);
  });

  it("exige medida só quando o tipo do serviço exige (medida_instalacao/medida_sem_instalacao)", () => {
    const comMedida = detail({
      fotos: [foto()],
      servico: servico({ tipo: "medida_instalacao", entrega_confirmada: true }),
    });
    expect(pendenciasParaConclusao(comMedida).map((p) => p.texto)).toContain("Nenhuma medida registrada");

    const semExigirMedida = detail({
      fotos: [foto()],
      servico: servico({ tipo: "criacao", entrega_confirmada: true }),
    });
    expect(pendenciasParaConclusao(semExigirMedida).map((p) => p.texto)).not.toContain(
      "Nenhuma medida registrada"
    );
  });

  it("sem foto nenhuma gera pendência de foto", () => {
    const d = detail({
      medidas: [medida()],
      servico: servico({ tipo: "criacao", entrega_confirmada: true }),
    });
    expect(pendenciasParaConclusao(d).map((p) => p.texto)).toContain("Nenhuma foto registrada");
  });

  it("entrega não confirmada sempre aparece, independente do resto", () => {
    const d = detail({
      medidas: [medida()],
      fotos: [foto()],
      servico: servico({ tipo: "criacao", entrega_confirmada: false }),
    });
    expect(pendenciasParaConclusao(d).map((p) => p.texto)).toContain("Entrega ainda não confirmada");
  });

  it("tudo em dia devolve lista vazia", () => {
    const d = detail({
      checklist: [checklistItem("Produção", true)],
      medidas: [medida()],
      fotos: [foto()],
      servico: servico({ tipo: "medida_instalacao", entrega_confirmada: true }),
    });
    expect(pendenciasParaConclusao(d)).toEqual([]);
  });

  it("nunca inclui nada relacionado a financeiro/saldo — pendência é só operacional", () => {
    const d = detail({
      servico: servico({
        tipo: "criacao",
        entrega_confirmada: false,
        financeiro_status: "Vencido",
        valor: 5000,
        valor_pago: 0,
      }),
    });
    const textos = pendenciasParaConclusao(d).map((p) => p.texto.toLowerCase());
    expect(textos.some((t) => t.includes("financ") || t.includes("saldo") || t.includes("pag"))).toBe(false);
  });
});

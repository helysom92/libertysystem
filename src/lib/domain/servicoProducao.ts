import type { Servico } from "./types";

/**
 * Campos de `servicos` seguros pra Produção — sem valor/valor_pago/financeiro_status/
 * liberado_admin/linha_orcamento/forma_pagamento/proposta/share_token. Usado nas páginas que
 * buscam a lista inteira do quadro (Kanban, Visão Geral, Hoje) pro papel `producao`, pra não
 * carregar dado financeiro pro navegador nem em bloco.
 */
export const CAMPOS_SERVICO_PRODUCAO =
  "id, numero, aprovado_em, cliente_id, cliente, descricao, tipo, estagio, coluna_id, concluido, prazo, prazo_tipo, prazo_inicio, informacoes_adicionais, local_instalacao, criado_em, concluido_em, responsavel, prioridade, entrega_confirmada, proxima_acao_texto, proxima_responsavel, proxima_prazo, motivo_espera, capa_foto_id";

/**
 * Completa o objeto restrito com placeholder neutro nos campos financeiros — assim o tipo
 * `Servico` continua batendo e os componentes existentes (ServicoCard, Kanban, etc.) não
 * precisam mudar; o valor de verdade nunca chega a ser buscado do banco pra Produção.
 */
export function toServicoProducaoSafe(row: Omit<Servico, keyof ServicoCamposFinanceiros>): Servico {
  return {
    ...row,
    valor: 0,
    valor_pago: 0,
    financeiro_status: "Não orçado",
    liberado_admin: false,
    linha_orcamento: null,
    validade_proposta_dias: 0,
    forma_pagamento_texto: null,
    durabilidade_texto: null,
    share_token: null,
    proposta_opcao_escolhida: null,
    proposta_escolhida_em: null,
  };
}

type ServicoCamposFinanceiros =
  | "valor"
  | "valor_pago"
  | "financeiro_status"
  | "liberado_admin"
  | "linha_orcamento"
  | "validade_proposta_dias"
  | "forma_pagamento_texto"
  | "durabilidade_texto"
  | "share_token"
  | "proposta_opcao_escolhida"
  | "proposta_escolhida_em";

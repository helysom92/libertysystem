import type { FinanceiroStatus, Prioridade, ServicoTipo } from "./flows";
import type { LinhaOrcamento } from "./orcamento";
import type { PrazoTipo } from "./kanban";

export interface Servico {
  id: string;
  numero: string | null; // null até aprovação — antes disso é um Orçamento sem numeração formal
  aprovado_em: string | null; // ISO timestamp — quando o orçamento virou OS (numero atribuído)
  cliente_id: string;
  cliente: string;
  descricao: string;
  valor: number;
  valor_pago: number;
  tipo: ServicoTipo;
  estagio: string; // rótulo denormalizado da coluna atual (exibição/relatórios), não é mais o motor do fluxo
  coluna_id: string | null;
  concluido: boolean;
  prazo: string | null; // ISO date (yyyy-mm-dd) — data-fim do prazo
  prazo_tipo: PrazoTipo | null;
  prazo_inicio: string | null; // ISO date
  informacoes_adicionais: string | null;
  local_instalacao: string | null;
  criado_em: string; // ISO timestamp
  concluido_em: string | null;
  responsavel: string;
  prioridade: Prioridade;
  financeiro_status: FinanceiroStatus;
  entrega_confirmada: boolean;
  liberado_admin: boolean;
  proxima_acao_texto: string | null;
  proxima_responsavel: string | null;
  proxima_prazo: string | null;
  motivo_espera: string | null;
  capa_foto_id: string | null;
  linha_orcamento: LinhaOrcamento | null;
  validade_proposta_dias: number;
  forma_pagamento_texto: string | null;
  durabilidade_texto: string | null;
  share_token: string | null;
  proposta_opcao_escolhida: LinhaOrcamento | null;
  proposta_escolhida_em: string | null;
}

/** Só o necessário pra vincular uma despesa avulsa a uma OS já numerada (Nova Despesa). */
export interface ServicoParaVinculo {
  id: string;
  numero: string;
  cliente: string;
  descricao: string;
}

export interface LancamentoAtalho {
  id: string;
  descricao: string;
  categoria: string;
  fornecedor_id: string | null;
  forma_pagamento: string | null;
  ordem: number;
  ativo: boolean;
}

export type ClienteStatus = "pre_cadastro" | "regularizado" | "inativo";

export interface Cliente {
  id: string;
  nome: string;
  empresa: string | null;
  cpf_cnpj: string | null;
  cidade: string | null;
  endereco: string | null;
  whatsapp: string | null;
  whatsapp_2: string | null;
  email: string | null;
  observacoes: string | null;
  status: ClienteStatus;
  created_at: string;
}

export interface Fornecedor {
  id: string;
  nome: string;
  categoria: string | null;
  telefone: string | null;
  email: string | null;
  ativo: boolean;
  created_at: string;
}

export interface Material {
  id: string;
  nome: string;
  unidade: "m2" | "metro_linear" | "unidade";
  preco_unitario: number;
  categoria: string | null;
  ativo: boolean;
}

export interface ItemOrcamento {
  id: string;
  nome: string;
  tipo_cobranca: "m2" | "fixo";
  preco: number | null; // null = sob projeto, sem preço fixo
  categoria: string | null;
  ativo: boolean;
}

/** Linha persistida de um orçamento multi-item (aba "Itens" da Central do Serviço). */
export interface OrcamentoItemRow {
  id: string;
  servico_id: string;
  ordem: number;
  descricao: string;
  categoria_prazo: "balcao" | "simples" | "complexo";
  modo_calculo: "catalogo" | "formula" | "m2_manual";
  item_orcamento_id: string | null;
  largura_cm: number | null;
  altura_cm: number | null;
  quantidade: number;
  custo_direto: number | null;
  preco_m2_manual: number | null;
  valor_final: number;
  mostrar_medida_cliente: boolean;
}

/** Uma das até-3 linhas (Promocional/Custo-Benefício/Premium) de uma proposta interativa. */
export interface PropostaOpcao {
  id: string;
  servico_id: string;
  linha: LinhaOrcamento;
  titulo: string;
  descricao: string | null;
  valor: number;
  ordem: number;
}

export interface Comprovante {
  id: string;
  descricao: string;
  banco: string | null;
  valor: number;
  data: string;
  status: "pendente" | "confirmado";
  servico_id: string | null;
}

export interface IaAlert {
  texto: string;
  color: string;
  servicoId: string | null;
  servicoNumero: string | null;
}

export interface Medicao {
  id: string;
  servico_id: string;
  largura: number | null;
  altura: number | null;
  profundidade: number | null;
  unidade: "m" | "cm" | "mm";
  quantidade: number;
  local_medicao: string | null;
  responsavel: string | null;
  data: string;
  observacoes: string | null;
  status_revisao: "Pendente" | "Confirmada";
}

export interface Arquivo {
  id: string;
  servico_id: string;
  nome: string;
  storage_path: string;
  tamanho_bytes: number | null;
  content_type: string | null;
  criado_em: string;
}

export interface Foto {
  id: string;
  servico_id: string;
  slot: number;
  storage_path: string | null;
  crop: { scale: number; x: number; y: number } | null;
}

export interface ChecklistItem {
  id: string;
  servico_id: string;
  texto: string;
  done: boolean;
  ordem: number;
}

export interface LogEntry {
  id: string;
  servico_id: string;
  texto: string;
  criado_em: string;
}

export type LancamentoStatus = "previsto" | "realizado" | "cancelado";

export interface FechamentoMensal {
  id: string;
  ano: number;
  mes: number;
  entrou: number;
  saiu: number;
  lucro: number;
  fechado_em: string;
  fechado_por: string | null;
}

export interface Lancamento {
  id: string;
  tipo: "Receita" | "Despesa";
  descricao: string;
  categoria: string | null;
  valor: number;
  data: string;
  servico_id: string | null;
  fornecedor_id: string | null;
  banco: string | null;
  forma_pagamento: string | null;
  status: LancamentoStatus;
}

export interface DespesaFixa {
  id: string;
  descricao: string;
  valor: number;
  dia_vencimento: number;
  categoria: string | null;
  fornecedor_id: string | null;
  ativo: boolean;
}

export interface DespesaFixaOcorrencia {
  id: string;
  despesa_fixa_id: string;
  ano: number;
  mes: number;
  pago: boolean;
  pago_em: string | null;
  lancamento_id: string | null;
  cancelada_em: string | null;
  cancelada_por: string | null;
  motivo_cancelamento: string | null;
  valor_pago: number | null;
}

/** Água, energia, comissão etc. — sem valor fixo nem dia certo; valor_provisionado é só a
 * estimativa mensal, o valor real de cada mês fica na ocorrência (editável). */
export interface DespesaVariavel {
  id: string;
  descricao: string;
  valor_provisionado: number;
  categoria: string | null;
  fornecedor_id: string | null;
  data: string | null; // ISO date — quando foi paga/lançada (essas despesas não têm vencimento fixo)
  ativo: boolean;
}

export interface DespesaVariavelOcorrencia {
  id: string;
  despesa_variavel_id: string;
  ano: number;
  mes: number;
  valor_real: number | null;
  pago: boolean;
  pago_em: string | null;
  lancamento_id: string | null;
  cancelada_em: string | null;
  cancelada_por: string | null;
  motivo_cancelamento: string | null;
  valor_pago: number | null;
}

export interface Evento {
  id: string;
  data: string;
  hora: string;
  tipo: string;
  servico_id: string | null;
  cliente: string | null;
  endereco: string | null;
  responsavel: string | null;
  whatsapp: string | null;
}

/** Um pagamento previsto/recebido de um serviço (sinal, restante, ou qualquer parcela
 * customizada). `valor_pago`/`pago_em` ficam nulos até a parcela ser confirmada. */
export interface ServicoParcela {
  id: string;
  servico_id: string;
  ordem: number;
  descricao: string;
  valor_previsto: number;
  data_prevista: string | null;
  valor_pago: number | null;
  pago_em: string | null;
  forma_pagamento: string | null;
  lancamento_id: string | null;
  cancelada_em: string | null;
  cancelada_por: string | null;
  motivo_cancelamento: string | null;
}

/** Log único de auditoria (Etapa 3) — todo pagamento/cancelamento/estorno de uma entidade
 * financeira gera uma linha aqui. Append-only de verdade desde a correção pontual (sem policy
 * de update/delete — antes era "for all", dava pra editar/apagar um evento já gravado). */
export interface FinanceiroEvento {
  id: string;
  entidade:
    | "lancamento"
    | "parcela"
    | "despesa_fixa_ocorrencia"
    | "despesa_variavel_ocorrencia"
    | "servico"
    | "parcela_recebimento";
  entidade_id: string;
  evento: "pagamento_total" | "pagamento_parcial" | "cancelamento" | "estorno";
  valor_anterior: number | null;
  valor_novo: number | null;
  motivo: string | null;
  usuario_id: string | null;
  criado_em: string;
}

/** Um recebimento individual de uma parcela (correção pontual pós-Etapa-3) — antes só existia
 * `servico_parcelas.valor_pago` como total acumulado, sem jeito de identificar/estornar um
 * recebimento específico quando há mais de um. */
export interface ParcelaRecebimento {
  id: string;
  parcela_id: string;
  lancamento_id: string | null;
  valor: number;
  data: string;
  forma_pagamento: string | null;
  usuario_id: string | null;
  criado_em: string;
  estornado_em: string | null;
  estornado_por: string | null;
  motivo_estorno: string | null;
}

/** Mesmo conceito de `ParcelaRecebimento`, pro lado das ocorrências de despesa (fixa/variável). */
export interface DespesaOcorrenciaPagamento {
  id: string;
  entidade: "despesa_fixa_ocorrencia" | "despesa_variavel_ocorrencia";
  ocorrencia_id: string;
  lancamento_id: string | null;
  valor: number;
  data: string;
  usuario_id: string | null;
  criado_em: string;
  estornado_em: string | null;
  estornado_por: string | null;
  motivo_estorno: string | null;
}

export interface ServicoDetail {
  servico: Servico;
  cliente: Cliente;
  medidas: Medicao[];
  arquivos: Arquivo[];
  fotos: Foto[];
  checklist: ChecklistItem[];
  timeline: LogEntry[];
  historico: LogEntry[];
  orcamentoItens: OrcamentoItemRow[];
  propostaOpcoes: PropostaOpcao[];
  eventos: Evento[];
  parcelas: ServicoParcela[];
}

/** Days between today and an ISO date string (positive = future, negative = past). Null if no date. */
export function daysUntil(isoDate: string | null, today: Date = new Date()): number | null {
  if (!isoDate) return null;
  const target = new Date(isoDate + "T00:00:00");
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffMs = target.getTime() - t0.getTime();
  return Math.round(diffMs / 86_400_000);
}

export function daysSince(isoDateTime: string, today: Date = new Date()): number {
  const created = new Date(isoDateTime);
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const c0 = new Date(created.getFullYear(), created.getMonth(), created.getDate());
  return Math.round((t0.getTime() - c0.getTime()) / 86_400_000);
}

export function fmtBRL(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** "OS-1001" once aprovado; "Orçamento" enquanto o serviço ainda não tem numeração. */
export function displayNumero(servico: { numero: string | null }): string {
  return servico.numero ?? "Orçamento";
}

/** Pra onde apontar um link "abrir esse serviço": orçamentos (sem numeração) moram no
 * Kanban de Comercial, OS numeradas moram no Kanban de Produção. */
export function servicoOpenHref(servico: { id: string; numero: string | null }): string {
  return servico.numero == null
    ? `/comercial/orcamentos?open=${servico.id}`
    : `/producao/servicos?open=${servico.id}`;
}

// ── Finanças Pessoais (módulo exclusivo do Helysom, isolado do Financeiro empresarial) ──

export type RecorrenciaPessoal = "unica" | "mensal" | "semanal" | "anual";

export interface ContaPessoal {
  id: string;
  owner_id: string;
  nome: string;
  instituicao: string | null;
  tipo: string | null;
  saldo_inicial: number;
  data_saldo_inicial: string;
  ativa: boolean;
}

export interface OrigemReceitaPessoal {
  id: string;
  owner_id: string;
  nome: string;
  ativo: boolean;
}

export type SituacaoReceitaPessoal = "prevista" | "parcial" | "recebida" | "cancelada";

export interface ReceitaPessoal {
  id: string;
  owner_id: string;
  descricao: string;
  origem_id: string | null;
  pagador: string | null;
  categoria: string | null;
  valor_previsto: number;
  valor_recebido: number;
  conta_destino_id: string | null;
  data_prevista: string | null;
  data_efetiva: string | null;
  recorrencia: RecorrenciaPessoal;
  situacao: SituacaoReceitaPessoal;
  observacoes: string | null;
  cancelada_em: string | null;
  motivo_cancelamento: string | null;
}

export interface RecebimentoPessoal {
  id: string;
  receita_id: string;
  valor: number;
  data: string;
  conta_destino_id: string | null;
  criado_em: string;
  estornado_em: string | null;
  motivo_estorno: string | null;
}

export type SituacaoDespesaPessoal = "prevista" | "parcial" | "paga" | "cancelada";

export interface DespesaPessoal {
  id: string;
  owner_id: string;
  descricao: string;
  categoria: string | null;
  favorecido: string | null;
  valor_previsto: number;
  valor_pago: number;
  conta_id: string | null;
  vencimento: string | null;
  data_efetiva: string | null;
  recorrencia: RecorrenciaPessoal;
  situacao: SituacaoDespesaPessoal;
  observacoes: string | null;
  cancelada_em: string | null;
  motivo_cancelamento: string | null;
}

export interface PagamentoPessoal {
  id: string;
  despesa_id: string;
  valor: number;
  data: string;
  conta_id: string | null;
  criado_em: string;
  estornado_em: string | null;
  motivo_estorno: string | null;
}

export interface TransferenciaPessoal {
  id: string;
  owner_id: string;
  conta_origem_id: string;
  conta_destino_id: string;
  valor: number;
  tarifa: number;
  data: string;
  descricao: string | null;
}

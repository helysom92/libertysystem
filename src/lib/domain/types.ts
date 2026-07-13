import type { DcItem, FinanceiroStatus, Prioridade, ServicoTipo } from "./flows";

export interface Servico {
  id: string;
  numero: string;
  cliente_id: string;
  cliente: string;
  descricao: string;
  valor: number;
  valor_pago: number;
  tipo: ServicoTipo;
  estagio: string;
  prazo: string | null; // ISO date (yyyy-mm-dd)
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
  dc_admin: DcItem[];
  dc_producao: DcItem[];
  dc_invalidated_after_advance: boolean;
}

export interface Cliente {
  id: string;
  nome: string;
  empresa: string | null;
  cpf_cnpj: string | null;
  cidade: string | null;
  endereco: string | null;
  whatsapp: string | null;
  observacoes: string | null;
  created_at: string;
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

export interface Lancamento {
  id: string;
  tipo: "Receita" | "Despesa";
  descricao: string;
  categoria: string | null;
  valor: number;
  data: string;
  servico_id: string | null;
}

export interface DespesaFixa {
  id: string;
  descricao: string;
  valor: number;
  dia_vencimento: number;
  categoria: string | null;
  ativo: boolean;
}

export interface DespesaFixaOcorrencia {
  id: string;
  despesa_fixa_id: string;
  ano: number;
  mes: number;
  pago: boolean;
  pago_em: string | null;
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

export interface ServicoDetail {
  servico: Servico;
  cliente: Cliente;
  medidas: Medicao[];
  arquivos: Arquivo[];
  fotos: Foto[];
  checklist: ChecklistItem[];
  timeline: LogEntry[];
  historico: LogEntry[];
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

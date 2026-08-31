"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireHelysom } from "@/lib/domain/permissions";
import type { RecorrenciaPessoal } from "@/lib/domain/types";

/**
 * Next.js 16 mascara toda mensagem de `throw` numa Server Action em produção (vira um texto
 * genérico + digest, sem a mensagem real — comportamento diferente do que versões anteriores
 * do Next faziam, confirmado em teste manual e na doc oficial: "avoid using try/catch blocks
 * and throw errors. Instead, model expected errors as return values"). Por isso toda ação daqui
 * devolve `AcaoResultado` em vez de lançar — é a única forma confiável de uma mensagem de
 * bloqueio ("saldo insuficiente", "já tem histórico") chegar de verdade na tela.
 */
export type AcaoResultado = { ok: true } | { ok: false; message: string };
export type AcaoComSaldo = { ok: true; saldoRestante: number } | { ok: false; message: string };

function revalidateFinancasPessoaisPaths() {
  revalidatePath("/financas-pessoais");
  revalidatePath("/financas-pessoais/visao-geral");
  revalidatePath("/financas-pessoais/receitas-despesas");
  revalidatePath("/financas-pessoais/contas");
}

// ── Contas ──────────────────────────────────────────────────────────────────────────────────

export interface ContaInput {
  nome: string;
  instituicao: string | null;
  tipo: string | null;
  saldo_inicial: number;
  data_saldo_inicial: string;
}

export async function createConta(input: ContaInput): Promise<AcaoResultado> {
  const profile = await requireHelysom();
  const supabase = await createClient();
  const { error } = await supabase.from("contas_pessoais").insert({ ...input, owner_id: profile.id });
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

export async function updateConta(id: string, input: ContaInput): Promise<AcaoResultado> {
  await requireHelysom();
  const supabase = await createClient();
  const { error } = await supabase.from("contas_pessoais").update(input).eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

/** Arquivar, nunca apagar — "arquivar uma conta não pode apagar seu histórico" (pedido
 * original). Uma conta arquivada some das opções de nova movimentação, mas o que já existe
 * (receitas/despesas/transferências vinculadas) continua intacto e consultável. */
export async function arquivarConta(id: string, ativa: boolean): Promise<AcaoResultado> {
  await requireHelysom();
  const supabase = await createClient();
  const { error } = await supabase.from("contas_pessoais").update({ ativa }).eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

// ── Origens de receita (catálogo editável) ─────────────────────────────────────────────────

export async function createOrigemReceita(nome: string): Promise<AcaoResultado> {
  const profile = await requireHelysom();
  const supabase = await createClient();
  const { error } = await supabase.from("origens_receita_pessoal").insert({ nome, owner_id: profile.id });
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

export async function renomearOrigemReceita(id: string, nome: string): Promise<AcaoResultado> {
  await requireHelysom();
  const supabase = await createClient();
  const { error } = await supabase.from("origens_receita_pessoal").update({ nome }).eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

export async function arquivarOrigemReceita(id: string, ativo: boolean): Promise<AcaoResultado> {
  await requireHelysom();
  const supabase = await createClient();
  const { error } = await supabase.from("origens_receita_pessoal").update({ ativo }).eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

// ── Receitas ────────────────────────────────────────────────────────────────────────────────

export interface ReceitaInput {
  descricao: string;
  origem_id: string | null;
  pagador: string | null;
  categoria: string | null;
  valor_previsto: number;
  conta_destino_id: string | null;
  data_prevista: string | null;
  recorrencia: RecorrenciaPessoal;
  observacoes: string | null;
}

export async function createReceita(input: ReceitaInput): Promise<AcaoResultado> {
  const profile = await requireHelysom();
  const supabase = await createClient();
  const { error } = await supabase.from("receitas_pessoais").insert({ ...input, owner_id: profile.id });
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

export async function updateReceita(id: string, input: ReceitaInput): Promise<AcaoResultado> {
  await requireHelysom();
  const supabase = await createClient();
  const { error } = await supabase.from("receitas_pessoais").update(input).eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

/** Cria a próxima ocorrência de uma receita recorrente a partir de uma já existente — sem
 * geração automática (o Helysom decide quando), copia descrição/origem/categoria/conta/valor
 * e desloca a data prevista um período pra frente. */
export async function duplicarReceitaProximoPeriodo(id: string): Promise<AcaoResultado> {
  const profile = await requireHelysom();
  const supabase = await createClient();
  const { data: origem, error: errOrigem } = await supabase.from("receitas_pessoais").select("*").eq("id", id).single();
  if (errOrigem || !origem) return { ok: false, message: errOrigem?.message ?? "Receita não encontrada." };

  const proximaData = deslocarData(origem.data_prevista, origem.recorrencia);
  const { error } = await supabase.from("receitas_pessoais").insert({
    owner_id: profile.id,
    descricao: origem.descricao,
    origem_id: origem.origem_id,
    pagador: origem.pagador,
    categoria: origem.categoria,
    valor_previsto: origem.valor_previsto,
    conta_destino_id: origem.conta_destino_id,
    data_prevista: proximaData,
    recorrencia: origem.recorrencia,
    observacoes: origem.observacoes,
  });
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

/** Bloqueia exclusão de receita já recebida no banco (trigger, migration 0039) — a mensagem do
 * Postgres já orienta cancelar em vez de excluir, só repassa. */
export async function deleteReceita(id: string): Promise<AcaoResultado> {
  await requireHelysom();
  const supabase = await createClient();
  const { error } = await supabase.from("receitas_pessoais").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

export async function cancelarReceita(id: string, motivo: string | null): Promise<AcaoResultado> {
  await requireHelysom();
  const supabase = await createClient();
  const { error } = await supabase
    .from("receitas_pessoais")
    .update({ situacao: "cancelada", cancelada_em: new Date().toISOString(), motivo_cancelamento: motivo })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

/** Registra um recebimento (total ou parcial) via RPC atômica `registrar_recebimento_pessoal`
 * (migration 0039) — bloqueia (não avisa) valor acima do saldo em aberto, mesmo padrão já
 * validado no lado empresarial (migration 0037). */
export async function registrarRecebimento(
  receitaId: string,
  fields: { valor: number; data: string; contaDestinoId: string | null }
): Promise<AcaoComSaldo> {
  await requireHelysom();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("registrar_recebimento_pessoal", {
    p_receita_id: receitaId,
    p_valor: fields.valor,
    p_data: fields.data,
    p_conta_destino_id: fields.contaDestinoId,
  });
  if (error) return { ok: false, message: error.message };
  const resultado = data as { ok: boolean; reason?: string; saldoRestante?: number };
  if (!resultado.ok) return { ok: false, message: resultado.reason ?? "Não foi possível registrar esse recebimento." };
  revalidateFinancasPessoaisPaths();
  return { ok: true, saldoRestante: resultado.saldoRestante ?? 0 };
}

export async function listarRecebimentosDaReceita(receitaId: string) {
  await requireHelysom();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recebimentos_pessoais")
    .select("*")
    .eq("receita_id", receitaId)
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function estornarRecebimento(recebimentoId: string, motivo: string | null): Promise<AcaoResultado> {
  await requireHelysom();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("estornar_recebimento_pessoal", {
    p_recebimento_id: recebimentoId,
    p_motivo: motivo,
  });
  if (error) return { ok: false, message: error.message };
  const resultado = data as { ok: boolean; reason?: string };
  if (!resultado.ok) return { ok: false, message: resultado.reason ?? "Não foi possível estornar esse recebimento." };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

// ── Despesas ────────────────────────────────────────────────────────────────────────────────

export interface DespesaInput {
  descricao: string;
  categoria: string | null;
  favorecido: string | null;
  valor_previsto: number;
  conta_id: string | null;
  vencimento: string | null;
  recorrencia: RecorrenciaPessoal;
  observacoes: string | null;
}

export async function createDespesa(input: DespesaInput): Promise<AcaoResultado> {
  const profile = await requireHelysom();
  const supabase = await createClient();
  const { error } = await supabase.from("despesas_pessoais").insert({ ...input, owner_id: profile.id });
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

export async function updateDespesa(id: string, input: DespesaInput): Promise<AcaoResultado> {
  await requireHelysom();
  const supabase = await createClient();
  const { error } = await supabase.from("despesas_pessoais").update(input).eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

export async function duplicarDespesaProximoPeriodo(id: string): Promise<AcaoResultado> {
  const profile = await requireHelysom();
  const supabase = await createClient();
  const { data: origem, error: errOrigem } = await supabase.from("despesas_pessoais").select("*").eq("id", id).single();
  if (errOrigem || !origem) return { ok: false, message: errOrigem?.message ?? "Despesa não encontrada." };

  const proximoVencimento = deslocarData(origem.vencimento, origem.recorrencia);
  const { error } = await supabase.from("despesas_pessoais").insert({
    owner_id: profile.id,
    descricao: origem.descricao,
    categoria: origem.categoria,
    favorecido: origem.favorecido,
    valor_previsto: origem.valor_previsto,
    conta_id: origem.conta_id,
    vencimento: proximoVencimento,
    recorrencia: origem.recorrencia,
    observacoes: origem.observacoes,
  });
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

export async function deleteDespesa(id: string): Promise<AcaoResultado> {
  await requireHelysom();
  const supabase = await createClient();
  const { error } = await supabase.from("despesas_pessoais").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

export async function cancelarDespesa(id: string, motivo: string | null): Promise<AcaoResultado> {
  await requireHelysom();
  const supabase = await createClient();
  const { error } = await supabase
    .from("despesas_pessoais")
    .update({ situacao: "cancelada", cancelada_em: new Date().toISOString(), motivo_cancelamento: motivo })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

export async function registrarPagamento(
  despesaId: string,
  fields: { valor: number; data: string; contaId: string | null }
): Promise<AcaoComSaldo> {
  await requireHelysom();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("registrar_pagamento_pessoal", {
    p_despesa_id: despesaId,
    p_valor: fields.valor,
    p_data: fields.data,
    p_conta_id: fields.contaId,
  });
  if (error) return { ok: false, message: error.message };
  const resultado = data as { ok: boolean; reason?: string; saldoRestante?: number };
  if (!resultado.ok) return { ok: false, message: resultado.reason ?? "Não foi possível registrar esse pagamento." };
  revalidateFinancasPessoaisPaths();
  return { ok: true, saldoRestante: resultado.saldoRestante ?? 0 };
}

export async function listarPagamentosDaDespesa(despesaId: string) {
  await requireHelysom();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pagamentos_pessoais")
    .select("*")
    .eq("despesa_id", despesaId)
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function estornarPagamento(pagamentoId: string, motivo: string | null): Promise<AcaoResultado> {
  await requireHelysom();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("estornar_pagamento_pessoal", {
    p_pagamento_id: pagamentoId,
    p_motivo: motivo,
  });
  if (error) return { ok: false, message: error.message };
  const resultado = data as { ok: boolean; reason?: string };
  if (!resultado.ok) return { ok: false, message: resultado.reason ?? "Não foi possível estornar esse pagamento." };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

// ── Transferências ──────────────────────────────────────────────────────────────────────────

export interface TransferenciaInput {
  conta_origem_id: string;
  conta_destino_id: string;
  valor: number;
  tarifa: number;
  data: string;
  descricao: string | null;
}

export async function createTransferencia(input: TransferenciaInput): Promise<AcaoResultado> {
  const profile = await requireHelysom();
  if (input.conta_origem_id === input.conta_destino_id) {
    return { ok: false, message: "A conta de origem e destino não podem ser a mesma." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("transferencias_pessoais").insert({ ...input, owner_id: profile.id });
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

// ── Auxiliar ────────────────────────────────────────────────────────────────────────────────

function deslocarData(data: string | null, recorrencia: RecorrenciaPessoal): string | null {
  if (!data) return null;
  const d = new Date(data + "T00:00:00");
  if (recorrencia === "semanal") d.setDate(d.getDate() + 7);
  else if (recorrencia === "anual") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1); // 'mensal' e 'unica' (duplicar única também avança 1 mês por padrão)
  return d.toISOString().slice(0, 10);
}

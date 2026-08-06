"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ServicoTipo } from "@/lib/domain/flows";
import type { LinhaOrcamento } from "@/lib/domain/orcamento";
import { calcularPrazoFim, type PrazoTipo } from "@/lib/domain/kanban";
import { todayISO } from "@/lib/domain/dates";

export interface NovoServicoInput {
  cliente: string;
  descricao: string;
  valor: number;
  prazo: string | null;
  tipo: ServicoTipo;
  linha_orcamento?: LinhaOrcamento;
  validade_proposta_dias?: number;
  forma_pagamento_texto?: string | null;
  durabilidade_texto?: string | null;
}

export async function createServico(input: NovoServicoInput) {
  const supabase = await createClient();

  const { data: clienteId, error: clienteErr } = await supabase.rpc("find_or_create_cliente", {
    p_nome: input.cliente,
  });
  if (clienteErr) throw clienteErr;

  const { data, error } = await supabase
    .from("servicos")
    .insert({
      cliente_id: clienteId,
      cliente: input.cliente,
      descricao: input.descricao,
      valor: input.valor,
      tipo: input.tipo,
      prazo: input.prazo,
      linha_orcamento: input.linha_orcamento,
      validade_proposta_dias: input.validade_proposta_dias,
      forma_pagamento_texto: input.forma_pagamento_texto,
      durabilidade_texto: input.durabilidade_texto,
    })
    .select("id")
    .single();
  if (error) throw error;

  revalidatePath("/servicos");
  revalidatePath("/hoje");
  return data.id as string;
}

export async function updatePrazoServico(servicoId: string, tipo: PrazoTipo) {
  const supabase = await createClient();
  const { data: sv } = await supabase
    .from("servicos")
    .select("prazo_inicio")
    .eq("id", servicoId)
    .single();
  const inicio = sv?.prazo_inicio ?? todayISO();
  const fim = calcularPrazoFim(inicio, tipo);
  const { error } = await supabase
    .from("servicos")
    .update({ prazo_tipo: tipo, prazo_inicio: inicio, prazo: fim })
    .eq("id", servicoId);
  if (error) throw error;
  revalidatePath("/servicos");
}

export async function updateInformacoesAdicionais(servicoId: string, texto: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("servicos")
    .update({ informacoes_adicionais: texto })
    .eq("id", servicoId);
  if (error) throw error;
  revalidatePath("/servicos");
}

export async function toggleEntregaConfirmada(servicoId: string, value: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("servicos")
    .update({ entrega_confirmada: value })
    .eq("id", servicoId);
  if (error) throw error;
  revalidatePath("/servicos");
}

export async function toggleLiberadoAdmin(servicoId: string, value: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("servicos")
    .update({ liberado_admin: value })
    .eq("id", servicoId);
  if (error) throw error;
  revalidatePath("/servicos");
}

export async function updateProximaAcao(
  servicoId: string,
  fields: { proxima_acao_texto?: string; proxima_responsavel?: string; proxima_prazo?: string; motivo_espera?: string }
) {
  const supabase = await createClient();
  const { error } = await supabase.from("servicos").update(fields).eq("id", servicoId);
  if (error) throw error;
  revalidatePath("/servicos");
}

export async function updateResponsavel(servicoId: string, responsavel: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("servicos").update({ responsavel }).eq("id", servicoId);
  if (error) throw error;
  revalidatePath("/servicos");
}

export async function updatePrioridade(servicoId: string, prioridade: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("servicos").update({ prioridade }).eq("id", servicoId);
  if (error) throw error;
  revalidatePath("/servicos");
}

export async function updateFinanceiro(
  servicoId: string,
  fields: { financeiro_status?: string; valor_pago?: number }
) {
  const supabase = await createClient();
  const { error } = await supabase.from("servicos").update(fields).eq("id", servicoId);
  if (error) throw error;
  revalidatePath("/servicos");
  revalidatePath("/administrativo/financeiro");
}

export async function updatePropostaOrcamento(
  servicoId: string,
  fields: Partial<{
    linha_orcamento: LinhaOrcamento;
    validade_proposta_dias: number;
    forma_pagamento_texto: string | null;
    durabilidade_texto: string | null;
  }>
) {
  const supabase = await createClient();
  const { error } = await supabase.from("servicos").update(fields).eq("id", servicoId);
  if (error) throw error;
  revalidatePath("/servicos");
}

export async function ensureShareToken(servicoId: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ensure_share_token", { p_servico_id: servicoId });
  if (error) throw error;
  return data as string;
}

export async function deleteServico(servicoId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("servicos").delete().eq("id", servicoId);
  if (error) throw error;
  revalidatePath("/servicos");
}

export async function updateClienteInline(
  clienteId: string,
  fields: Partial<{
    nome: string;
    empresa: string | null;
    cpf_cnpj: string | null;
    cidade: string | null;
    endereco: string | null;
    whatsapp: string | null;
    observacoes: string | null;
  }>
) {
  const supabase = await createClient();
  const { error } = await supabase.from("clientes").update(fields).eq("id", clienteId);
  if (error) throw error;
  revalidatePath("/servicos");
}

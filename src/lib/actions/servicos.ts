"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ServicoTipo } from "@/lib/domain/flows";

export interface NovoServicoInput {
  cliente: string;
  descricao: string;
  valor: number;
  prazo: string | null;
  tipo: ServicoTipo;
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
    })
    .select("id")
    .single();
  if (error) throw error;

  revalidatePath("/servicos");
  revalidatePath("/hoje");
  return data.id as string;
}

export async function moveServico(servicoId: string, dir: 1 | -1) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("move_servico", {
    p_servico_id: servicoId,
    p_dir: dir,
  });
  if (error) throw error;
  revalidatePath("/servicos");
  revalidatePath("/hoje");
  revalidatePath("/gestao");
}

export async function toggleDcItem(
  servicoId: string,
  which: "admin" | "producao",
  index: number,
  items: { texto: string; done: boolean }[]
) {
  const supabase = await createClient();
  const updated = items.map((item, i) => (i === index ? { ...item, done: !item.done } : item));
  const column = which === "admin" ? "dc_admin" : "dc_producao";
  const { error } = await supabase.from("servicos").update({ [column]: updated }).eq("id", servicoId);
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
  revalidatePath("/financeiro");
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

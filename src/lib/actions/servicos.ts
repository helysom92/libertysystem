"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { revalidateServicoPaths } from "./revalidateServicos";
import { revalidateFinanceiroPaths } from "./revalidateFinanceiro";
import type { ServicoTipo } from "@/lib/domain/flows";
import type { LinhaOrcamento } from "@/lib/domain/orcamento";
import { calcularPrazoFim, type PrazoTipo } from "@/lib/domain/kanban";
import { todayISO } from "@/lib/domain/dates";
import { requireRole } from "@/lib/domain/permissions";

export interface NovoServicoInput {
  cliente: string;
  clienteWhatsapp?: string | null;
  descricao: string;
  valor: number;
  prazo: string | null;
  tipo: ServicoTipo;
  linha_orcamento?: LinhaOrcamento | null;
  validade_proposta_dias?: number;
  forma_pagamento_texto?: string | null;
  durabilidade_texto?: string | null;
  local_instalacao?: string | null;
}

export async function createServico(input: NovoServicoInput) {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();

  const { data: clienteId, error: clienteErr } = await supabase.rpc("find_or_create_cliente", {
    p_nome: input.cliente,
    p_whatsapp: input.clienteWhatsapp || null,
  });
  if (clienteErr) throw clienteErr;

  const { data, error } = await supabase
    .from("servicos")
    .insert({
      cliente_id: clienteId,
      cliente: input.cliente,
      descricao: input.descricao,
      valor: input.valor,
      financeiro_status: input.valor > 0 ? "Orçado" : "Não orçado",
      tipo: input.tipo,
      prazo: input.prazo,
      linha_orcamento: input.linha_orcamento,
      validade_proposta_dias: input.validade_proposta_dias,
      forma_pagamento_texto: input.forma_pagamento_texto,
      durabilidade_texto: input.durabilidade_texto,
      local_instalacao: input.local_instalacao,
    })
    .select("id")
    .single();
  if (error) throw error;

  revalidateServicoPaths();
  revalidatePath("/hoje");
  return data.id as string;
}

/** Cria um orçamento novo a partir de um já existente — mesmo cliente, descrição, proposta
 * e todos os itens copiados, pra não digitar tudo de novo num pedido parecido. */
export async function duplicarOrcamento(servicoId: string): Promise<string> {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();

  const { data: original, error: svErr } = await supabase
    .from("servicos")
    .select(
      "cliente_id, cliente, descricao, valor, tipo, linha_orcamento, validade_proposta_dias, forma_pagamento_texto, durabilidade_texto, local_instalacao"
    )
    .eq("id", servicoId)
    .single();
  if (svErr || !original) throw svErr ?? new Error("Orçamento não encontrado.");

  const { data: itens, error: itensErr } = await supabase
    .from("orcamento_itens")
    .select("*")
    .eq("servico_id", servicoId)
    .order("ordem");
  if (itensErr) throw itensErr;

  const { data: novo, error: insErr } = await supabase
    .from("servicos")
    .insert({
      cliente_id: original.cliente_id,
      cliente: original.cliente,
      descricao: original.descricao,
      valor: original.valor,
      financeiro_status: original.valor > 0 ? "Orçado" : "Não orçado",
      tipo: original.tipo,
      linha_orcamento: original.linha_orcamento,
      validade_proposta_dias: original.validade_proposta_dias,
      forma_pagamento_texto: original.forma_pagamento_texto,
      durabilidade_texto: original.durabilidade_texto,
      local_instalacao: original.local_instalacao,
    })
    .select("id")
    .single();
  if (insErr) throw insErr;

  if (itens && itens.length > 0) {
    const { error: itensInsErr } = await supabase.from("orcamento_itens").insert(
      itens.map((item) => ({
        servico_id: novo.id,
        ordem: item.ordem,
        descricao: item.descricao,
        categoria_prazo: item.categoria_prazo,
        modo_calculo: item.modo_calculo,
        item_orcamento_id: item.item_orcamento_id,
        largura_cm: item.largura_cm,
        altura_cm: item.altura_cm,
        quantidade: item.quantidade,
        custo_direto: item.custo_direto,
        preco_m2_manual: item.preco_m2_manual,
        valor_final: item.valor_final,
        mostrar_medida_cliente: item.mostrar_medida_cliente,
      }))
    );
    if (itensInsErr) throw itensInsErr;
  }

  revalidateServicoPaths();
  revalidatePath("/hoje");
  return novo.id as string;
}

export async function updateServicoOrcamento(
  servicoId: string,
  fields: Partial<{ tipo: ServicoTipo; descricao: string; prazo: string | null }>
) {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { error } = await supabase.from("servicos").update(fields).eq("id", servicoId);
  if (error) throw error;
  revalidateServicoPaths();
  revalidatePath("/hoje");
}

export async function updatePrazoServico(servicoId: string, tipo: PrazoTipo) {
  await requireRole("administrador", "secretaria", "producao");
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
  revalidateServicoPaths();
}

export async function updateInformacoesAdicionais(servicoId: string, texto: string) {
  await requireRole("administrador", "secretaria", "producao");
  const supabase = await createClient();
  const { error } = await supabase
    .from("servicos")
    .update({ informacoes_adicionais: texto })
    .eq("id", servicoId);
  if (error) throw error;
  revalidateServicoPaths();
}

export async function updateLocalInstalacao(servicoId: string, texto: string) {
  await requireRole("administrador", "secretaria", "producao");
  const supabase = await createClient();
  const { error } = await supabase
    .from("servicos")
    .update({ local_instalacao: texto })
    .eq("id", servicoId);
  if (error) throw error;
  revalidateServicoPaths();
}

export async function toggleEntregaConfirmada(servicoId: string, value: boolean) {
  await requireRole("administrador", "secretaria", "producao");
  const supabase = await createClient();
  const { error } = await supabase
    .from("servicos")
    .update({ entrega_confirmada: value })
    .eq("id", servicoId);
  if (error) throw error;
  revalidateServicoPaths();
}

export async function toggleLiberadoAdmin(servicoId: string, value: boolean) {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { error } = await supabase
    .from("servicos")
    .update({ liberado_admin: value })
    .eq("id", servicoId);
  if (error) throw error;
  revalidateServicoPaths();
}

export async function updateProximaAcao(
  servicoId: string,
  fields: { proxima_acao_texto?: string; proxima_responsavel?: string; proxima_prazo?: string; motivo_espera?: string }
) {
  await requireRole("administrador", "secretaria", "producao");
  const supabase = await createClient();
  const { error } = await supabase.from("servicos").update(fields).eq("id", servicoId);
  if (error) throw error;
  revalidateServicoPaths();
}

export async function updateResponsavel(servicoId: string, responsavel: string) {
  await requireRole("administrador", "secretaria", "producao");
  const supabase = await createClient();
  const { error } = await supabase.from("servicos").update({ responsavel }).eq("id", servicoId);
  if (error) throw error;
  revalidateServicoPaths();
}

export async function updatePrioridade(servicoId: string, prioridade: string) {
  await requireRole("administrador", "secretaria", "producao");
  const supabase = await createClient();
  const { error } = await supabase.from("servicos").update({ prioridade }).eq("id", servicoId);
  if (error) throw error;
  revalidateServicoPaths();
}

export async function updateFinanceiro(
  servicoId: string,
  fields: { financeiro_status?: string; valor_pago?: number }
) {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { error } = await supabase.from("servicos").update(fields).eq("id", servicoId);
  if (error) throw error;
  revalidateServicoPaths();
  revalidateFinanceiroPaths();
}

export async function updatePropostaOrcamento(
  servicoId: string,
  fields: Partial<{
    linha_orcamento: LinhaOrcamento | null;
    validade_proposta_dias: number;
    forma_pagamento_texto: string | null;
    durabilidade_texto: string | null;
  }>
) {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { error } = await supabase.from("servicos").update(fields).eq("id", servicoId);
  if (error) throw error;
  revalidateServicoPaths();
}

export async function ensureShareToken(servicoId: string): Promise<string> {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ensure_share_token", { p_servico_id: servicoId });
  if (error) throw error;
  return data as string;
}

/** Exclusão definitiva de um serviço — ação já irreversível e explícita (exige confirmação na
 * tela). `servico_parcelas` já cai sozinha via `on delete cascade`, mas `lancamentos.servico_id`
 * é `on delete set null` (pra não apagar histórico financeiro só por cancelamento de OS) — sem
 * isso, excluir a OS deixava lançamentos "órfãos" (sem OS, mas ainda contando nos totais do
 * Financeiro) que só dava pra achar manualmente. Já que apagar a OS já é uma decisão explícita
 * e definitiva do usuário, apaga junto os lançamentos vinculados a ela. */
export async function deleteServico(servicoId: string) {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { error: lancErr } = await supabase.from("lancamentos").delete().eq("servico_id", servicoId);
  if (lancErr) throw lancErr;
  const { error } = await supabase.from("servicos").delete().eq("id", servicoId);
  if (error) throw error;
  revalidateServicoPaths();
  revalidateFinanceiroPaths();
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
    whatsapp_2: string | null;
    email: string | null;
    observacoes: string | null;
  }>
) {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { error } = await supabase.from("clientes").update(fields).eq("id", clienteId);
  if (error) throw error;
  revalidateServicoPaths();
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { revalidateFinanceiroPaths } from "./revalidateFinanceiro";

export interface NovoLancamentoInput {
  tipo: "Receita" | "Despesa";
  descricao: string;
  categoria: string;
  valor: number;
  data: string;
  servico_id?: string | null;
  fornecedor_id?: string | null;
  banco?: string | null;
  forma_pagamento?: string | null;
  status?: "previsto" | "realizado" | "cancelado";
}

export async function createLancamento(input: NovoLancamentoInput) {
  const supabase = await createClient();
  const { error } = await supabase.from("lancamentos").insert(input);
  if (error) throw error;
  revalidateFinanceiroPaths();
  revalidatePath("/hoje");
}

export async function marcarLancamentoRealizado(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("lancamentos").update({ status: "realizado" }).eq("id", id);
  if (error) throw error;
  revalidateFinanceiroPaths();
  revalidatePath("/hoje");
}

export async function updateLancamento(id: string, input: NovoLancamentoInput) {
  const supabase = await createClient();
  const { error } = await supabase.from("lancamentos").update(input).eq("id", id);
  if (error) throw error;
  revalidateFinanceiroPaths();
  revalidatePath("/hoje");
}

export async function deleteLancamento(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("lancamentos").delete().eq("id", id);
  if (error) throw error;
  revalidateFinanceiroPaths();
  revalidatePath("/hoje");
}

export interface NovaDespesaFixaInput {
  descricao: string;
  valor: number;
  dia_vencimento: number;
  categoria: string;
  fornecedor_id?: string | null;
}

export async function createDespesaFixa(input: NovaDespesaFixaInput) {
  const supabase = await createClient();
  const { error } = await supabase.from("despesas_fixas").insert(input);
  if (error) throw error;
  revalidateFinanceiroPaths();
}

export async function updateDespesaFixa(id: string, input: NovaDespesaFixaInput) {
  const supabase = await createClient();
  const { error } = await supabase.from("despesas_fixas").update(input).eq("id", id);
  if (error) throw error;
  revalidateFinanceiroPaths();
}

export async function deleteDespesaFixa(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("despesas_fixas").delete().eq("id", id);
  if (error) throw error;
  revalidateFinanceiroPaths();
}

export async function toggleDespesaOcorrencia(
  despesaFixaId: string,
  ano: number,
  mes: number,
  pago: boolean
) {
  const supabase = await createClient();
  const { error } = await supabase.from("despesas_fixas_ocorrencias").upsert(
    {
      despesa_fixa_id: despesaFixaId,
      ano,
      mes,
      pago,
      pago_em: pago ? new Date().toISOString() : null,
    },
    { onConflict: "despesa_fixa_id,ano,mes" }
  );
  if (error) throw error;
  revalidateFinanceiroPaths();
}

export interface NovaDespesaVariavelInput {
  descricao: string;
  valor_provisionado: number;
  categoria: string;
  fornecedor_id?: string | null;
}

export async function createDespesaVariavel(input: NovaDespesaVariavelInput) {
  const supabase = await createClient();
  const { error } = await supabase.from("despesas_variaveis").insert(input);
  if (error) throw error;
  revalidateFinanceiroPaths();
}

export async function updateDespesaVariavel(id: string, input: NovaDespesaVariavelInput) {
  const supabase = await createClient();
  const { error } = await supabase.from("despesas_variaveis").update(input).eq("id", id);
  if (error) throw error;
  revalidateFinanceiroPaths();
}

export async function deleteDespesaVariavel(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("despesas_variaveis").delete().eq("id", id);
  if (error) throw error;
  revalidateFinanceiroPaths();
}

export async function updateDespesaVariavelValor(
  despesaVariavelId: string,
  ano: number,
  mes: number,
  valorReal: number
) {
  const supabase = await createClient();
  const { error } = await supabase.from("despesas_variaveis_ocorrencias").upsert(
    { despesa_variavel_id: despesaVariavelId, ano, mes, valor_real: valorReal },
    { onConflict: "despesa_variavel_id,ano,mes" }
  );
  if (error) throw error;
  revalidateFinanceiroPaths();
}

export async function toggleDespesaVariavelPago(
  despesaVariavelId: string,
  ano: number,
  mes: number,
  pago: boolean
) {
  const supabase = await createClient();
  const { error } = await supabase.from("despesas_variaveis_ocorrencias").upsert(
    {
      despesa_variavel_id: despesaVariavelId,
      ano,
      mes,
      pago,
      pago_em: pago ? new Date().toISOString() : null,
    },
    { onConflict: "despesa_variavel_id,ano,mes" }
  );
  if (error) throw error;
  revalidateFinanceiroPaths();
}

/** Manual-entry equivalent of the prototype's "Simular Envio" (see plan §9 comprovante note). */
export async function registrarComprovante(input: {
  descricao: string;
  banco: string;
  valor: number;
  servico_id?: string | null;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("comprovantes").insert({
    descricao: input.descricao,
    banco: input.banco,
    valor: input.valor,
    servico_id: input.servico_id ?? null,
    status: "pendente",
  });
  if (error) throw error;
  revalidateFinanceiroPaths();
  revalidatePath("/hoje");
}

export async function deleteComprovante(id: string): Promise<{ ok: boolean; reason?: string }> {
  const supabase = await createClient();
  const { data: comprovante } = await supabase
    .from("comprovantes")
    .select("status")
    .eq("id", id)
    .single();
  if (comprovante?.status !== "pendente") {
    return { ok: false, reason: "Só é possível excluir comprovantes ainda pendentes." };
  }
  const { error } = await supabase.from("comprovantes").delete().eq("id", id);
  if (error) throw error;
  revalidateFinanceiroPaths();
  return { ok: true };
}

export async function confirmarComprovante(id: string) {
  const supabase = await createClient();
  const { data: comprovante, error: fetchErr } = await supabase
    .from("comprovantes")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchErr || !comprovante) throw fetchErr;

  const { error: lancErr } = await supabase.from("lancamentos").insert({
    tipo: "Receita",
    descricao: `Comprovante - ${comprovante.banco}`,
    categoria: "Comprovante IA",
    valor: comprovante.valor,
    data: comprovante.data,
    servico_id: comprovante.servico_id,
  });
  if (lancErr) throw lancErr;

  const { error: updErr } = await supabase
    .from("comprovantes")
    .update({ status: "confirmado" })
    .eq("id", id);
  if (updErr) throw updErr;

  revalidateFinanceiroPaths();
  revalidatePath("/hoje");
  revalidatePath("/gestao");
}

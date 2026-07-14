"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
  revalidatePath("/financeiro");
  revalidatePath("/hoje");
}

export async function marcarLancamentoRealizado(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("lancamentos").update({ status: "realizado" }).eq("id", id);
  if (error) throw error;
  revalidatePath("/financeiro");
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
  revalidatePath("/financeiro");
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
  revalidatePath("/financeiro");
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
  revalidatePath("/financeiro");
  revalidatePath("/hoje");
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

  revalidatePath("/financeiro");
  revalidatePath("/hoje");
  revalidatePath("/gestao");
}

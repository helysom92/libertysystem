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

function diaVencimentoParaData(ano: number, mes: number, diaVencimento: number) {
  const diasNoMes = new Date(ano, mes, 0).getDate();
  const dia = Math.min(diaVencimento, diasNoMes);
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/**
 * Marca/desmarca a ocorrência do mês como paga — e mantém um lançamento em `lancamentos` em
 * sincronia (cria ao marcar, apaga ao desmarcar), pra esse pagamento aparecer no Fluxo
 * Financeiro (Lançamentos) e contar nos totais "Realizado", igual já acontece com parcelas de
 * OS. Antes disso, marcar como pago só gravava aqui e nunca entrava no fluxo de lançamentos.
 */
export async function toggleDespesaOcorrencia(
  despesaFixaId: string,
  ano: number,
  mes: number,
  pago: boolean
) {
  const supabase = await createClient();

  const { data: existente } = await supabase
    .from("despesas_fixas_ocorrencias")
    .select("lancamento_id")
    .eq("despesa_fixa_id", despesaFixaId)
    .eq("ano", ano)
    .eq("mes", mes)
    .maybeSingle();

  let lancamentoId: string | null = existente?.lancamento_id ?? null;

  if (pago) {
    const { data: despesa, error: dErr } = await supabase
      .from("despesas_fixas")
      .select("descricao, valor, categoria, fornecedor_id, dia_vencimento")
      .eq("id", despesaFixaId)
      .single();
    if (dErr || !despesa) throw dErr ?? new Error("Despesa fixa não encontrada.");

    if (lancamentoId) {
      const { error: updErr } = await supabase
        .from("lancamentos")
        .update({ status: "realizado" })
        .eq("id", lancamentoId);
      if (updErr) throw updErr;
    } else {
      const { data: lanc, error: lancErr } = await supabase
        .from("lancamentos")
        .insert({
          tipo: "Despesa",
          descricao: despesa.descricao,
          categoria: despesa.categoria,
          valor: despesa.valor,
          data: diaVencimentoParaData(ano, mes, despesa.dia_vencimento),
          fornecedor_id: despesa.fornecedor_id,
          status: "realizado",
        })
        .select("id")
        .single();
      if (lancErr) throw lancErr;
      lancamentoId = lanc.id;
    }
  } else if (lancamentoId) {
    const { error: delErr } = await supabase.from("lancamentos").delete().eq("id", lancamentoId);
    if (delErr) throw delErr;
    lancamentoId = null;
  }

  const { error } = await supabase.from("despesas_fixas_ocorrencias").upsert(
    {
      despesa_fixa_id: despesaFixaId,
      ano,
      mes,
      pago,
      pago_em: pago ? new Date().toISOString() : null,
      lancamento_id: lancamentoId,
    },
    { onConflict: "despesa_fixa_id,ano,mes" }
  );
  if (error) throw error;
  revalidateFinanceiroPaths();
  revalidatePath("/hoje");
}

export interface NovaDespesaVariavelInput {
  descricao: string;
  valor_provisionado: number;
  categoria: string;
  fornecedor_id?: string | null;
  data?: string | null;
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
  const { data: existente } = await supabase
    .from("despesas_variaveis_ocorrencias")
    .select("lancamento_id")
    .eq("despesa_variavel_id", despesaVariavelId)
    .eq("ano", ano)
    .eq("mes", mes)
    .maybeSingle();

  const { error } = await supabase.from("despesas_variaveis_ocorrencias").upsert(
    { despesa_variavel_id: despesaVariavelId, ano, mes, valor_real: valorReal },
    { onConflict: "despesa_variavel_id,ano,mes" }
  );
  if (error) throw error;

  // Se essa ocorrência já estava paga (com lançamento vinculado), mantém o valor do
  // lançamento em sincronia com o valor real editado — evita duas fontes de verdade divergindo.
  if (existente?.lancamento_id) {
    await supabase.from("lancamentos").update({ valor: valorReal }).eq("id", existente.lancamento_id);
  }

  revalidateFinanceiroPaths();
}

/** Mesma sincronia de `toggleDespesaOcorrencia`, pro lado das despesas variáveis. */
export async function toggleDespesaVariavelPago(
  despesaVariavelId: string,
  ano: number,
  mes: number,
  pago: boolean
) {
  const supabase = await createClient();

  const { data: existente } = await supabase
    .from("despesas_variaveis_ocorrencias")
    .select("lancamento_id, valor_real")
    .eq("despesa_variavel_id", despesaVariavelId)
    .eq("ano", ano)
    .eq("mes", mes)
    .maybeSingle();

  let lancamentoId: string | null = existente?.lancamento_id ?? null;

  if (pago) {
    const { data: despesa, error: dErr } = await supabase
      .from("despesas_variaveis")
      .select("descricao, valor_provisionado, categoria, fornecedor_id, data")
      .eq("id", despesaVariavelId)
      .single();
    if (dErr || !despesa) throw dErr ?? new Error("Despesa variável não encontrada.");

    const valor = existente?.valor_real ?? despesa.valor_provisionado;
    // Usa a data que o usuário escolheu na despesa (quando pagou/lançou); sem ela, cai no
    // dia 1 do mês da ocorrência como aproximação.
    const data = despesa.data ?? `${ano}-${String(mes).padStart(2, "0")}-01`;

    if (lancamentoId) {
      const { error: updErr } = await supabase
        .from("lancamentos")
        .update({ status: "realizado", valor })
        .eq("id", lancamentoId);
      if (updErr) throw updErr;
    } else {
      const { data: lanc, error: lancErr } = await supabase
        .from("lancamentos")
        .insert({
          tipo: "Despesa",
          descricao: despesa.descricao,
          categoria: despesa.categoria,
          valor,
          data,
          fornecedor_id: despesa.fornecedor_id,
          status: "realizado",
        })
        .select("id")
        .single();
      if (lancErr) throw lancErr;
      lancamentoId = lanc.id;
    }
  } else if (lancamentoId) {
    const { error: delErr } = await supabase.from("lancamentos").delete().eq("id", lancamentoId);
    if (delErr) throw delErr;
    lancamentoId = null;
  }

  const { error } = await supabase.from("despesas_variaveis_ocorrencias").upsert(
    {
      despesa_variavel_id: despesaVariavelId,
      ano,
      mes,
      pago,
      pago_em: pago ? new Date().toISOString() : null,
      lancamento_id: lancamentoId,
    },
    { onConflict: "despesa_variavel_id,ano,mes" }
  );
  if (error) throw error;
  revalidateFinanceiroPaths();
  revalidatePath("/hoje");
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

export interface NovaDespesaRapidaInput {
  tipo: "fixa" | "variavel";
  descricao: string;
  categoria: string;
  fornecedor_id: string | null;
  valor: number;
  data: string; // "YYYY-MM-DD"
}

/**
 * "+ Nova Despesa" — cria a despesa (fixa ou variável) e já lança a ocorrência do
 * mês/dia escolhido como paga, reaproveitando o mesmo caminho de toggleDespesaOcorrencia /
 * toggleDespesaVariavelPago (que já cuida de gerar o lançamento em Financeiro). O
 * gerenciamento recorrente dos meses seguintes continua em "Gerenciar despesas recorrentes".
 */
export async function lancarNovaDespesa(input: NovaDespesaRapidaInput) {
  const supabase = await createClient();
  const [anoStr, mesStr, diaStr] = input.data.split("-");
  const ano = Number(anoStr);
  const mes = Number(mesStr);
  const dia = Number(diaStr);

  if (input.tipo === "fixa") {
    const { data: df, error } = await supabase
      .from("despesas_fixas")
      .insert({
        descricao: input.descricao,
        valor: input.valor,
        dia_vencimento: dia,
        categoria: input.categoria,
        fornecedor_id: input.fornecedor_id,
      })
      .select("id")
      .single();
    if (error) throw error;
    await toggleDespesaOcorrencia(df.id, ano, mes, true);
  } else {
    const { data: dv, error } = await supabase
      .from("despesas_variaveis")
      .insert({
        descricao: input.descricao,
        valor_provisionado: input.valor,
        categoria: input.categoria,
        fornecedor_id: input.fornecedor_id,
        data: input.data,
      })
      .select("id")
      .single();
    if (error) throw error;
    await toggleDespesaVariavelPago(dv.id, ano, mes, true);
  }
}

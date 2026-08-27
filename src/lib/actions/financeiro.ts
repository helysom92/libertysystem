"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { revalidateFinanceiroPaths } from "./revalidateFinanceiro";
import { requireRole } from "@/lib/domain/permissions";

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
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { error } = await supabase.from("lancamentos").insert(input);
  if (error) throw error;
  revalidateFinanceiroPaths();
  revalidatePath("/hoje");
}

export async function marcarLancamentoRealizado(id: string) {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { error } = await supabase.from("lancamentos").update({ status: "realizado" }).eq("id", id);
  if (error) throw error;
  revalidateFinanceiroPaths();
  revalidatePath("/hoje");
}

export async function updateLancamento(id: string, input: NovoLancamentoInput) {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { error } = await supabase.from("lancamentos").update(input).eq("id", id);
  if (error) throw error;
  revalidateFinanceiroPaths();
  revalidatePath("/hoje");
}

export async function deleteLancamento(id: string) {
  await requireRole("administrador", "secretaria");
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
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { error } = await supabase.from("despesas_fixas").insert(input);
  if (error) throw error;
  revalidateFinanceiroPaths();
}

export async function updateDespesaFixa(id: string, input: NovaDespesaFixaInput) {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { error } = await supabase.from("despesas_fixas").update(input).eq("id", id);
  if (error) throw error;
  revalidateFinanceiroPaths();
}

export async function deleteDespesaFixa(id: string) {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { error } = await supabase.from("despesas_fixas").delete().eq("id", id);
  if (error) throw error;
  revalidateFinanceiroPaths();
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
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  // RPC atômica (migration 0035) — evita a corrida de 2 lançamentos quando "marcar paga" é
  // clicado 2 vezes rápido: select+insert acontecem numa transação só, com a linha da
  // ocorrência travada durante toda a operação.
  const { error } = await supabase.rpc("toggle_despesa_fixa_ocorrencia", {
    p_despesa_fixa_id: despesaFixaId,
    p_ano: ano,
    p_mes: mes,
    p_pago: pago,
  });
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
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { error } = await supabase.from("despesas_variaveis").insert(input);
  if (error) throw error;
  revalidateFinanceiroPaths();
}

export async function updateDespesaVariavel(id: string, input: NovaDespesaVariavelInput) {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { error } = await supabase.from("despesas_variaveis").update(input).eq("id", id);
  if (error) throw error;
  revalidateFinanceiroPaths();
}

export async function deleteDespesaVariavel(id: string) {
  await requireRole("administrador", "secretaria");
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
  await requireRole("administrador", "secretaria");
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
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  // RPC atômica (migration 0035) — mesma correção de corrida do lado fixo.
  const { error } = await supabase.rpc("toggle_despesa_variavel_ocorrencia", {
    p_despesa_variavel_id: despesaVariavelId,
    p_ano: ano,
    p_mes: mes,
    p_pago: pago,
  });
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
  await requireRole("administrador", "secretaria");
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
  await requireRole("administrador", "secretaria");
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
  await requireRole("administrador", "secretaria");
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
  await requireRole("administrador", "secretaria");
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

/**
 * "+ Nova Despesa" quando o usuário puxa uma despesa recorrente já cadastrada (em vez de
 * criar uma nova) — só lança a ocorrência do mês/data escolhido. Pra fixa, o valor é o da
 * despesa (não existe override por mês nesse schema); pra variável, atualiza o valor_real
 * desse mês antes de marcar como paga.
 */
export async function lancarDespesaExistente(input: {
  tipo: "fixa" | "variavel";
  despesaId: string;
  valor: number;
  data: string;
}) {
  await requireRole("administrador", "secretaria");
  const [anoStr, mesStr] = input.data.split("-");
  const ano = Number(anoStr);
  const mes = Number(mesStr);

  if (input.tipo === "fixa") {
    await toggleDespesaOcorrencia(input.despesaId, ano, mes, true);
  } else {
    await updateDespesaVariavelValor(input.despesaId, ano, mes, input.valor);
    await toggleDespesaVariavelPago(input.despesaId, ano, mes, true);
  }
}

export interface DespesaParceladaInput {
  descricao: string;
  categoria: string;
  fornecedor_id: string | null;
  valorParcela: number;
  totalParcelas: number;
  primeiraData: string;
  primeiraPaga: boolean;
  servico_id: string | null;
}

/**
 * Compra parcelada (ex: equipamento em 10x) — gera as N parcelas de uma vez, uma por mês a
 * partir da primeira data, cada uma como um lançamento próprio (previsto, exceto a 1ª se já
 * paga). Diferente de despesa fixa: tem fim certo, não repete pra sempre.
 */
export async function lancarDespesaParcelada(input: DespesaParceladaInput) {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const [anoStr, mesStr, diaStr] = input.primeiraData.split("-");
  const ano = Number(anoStr);
  const mes = Number(mesStr);
  const dia = Number(diaStr);

  const linhas = Array.from({ length: input.totalParcelas }, (_, i) => {
    const d = new Date(ano, mes - 1 + i, dia);
    const dataParcela = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return {
      tipo: "Despesa" as const,
      descricao: `${input.descricao} (Parcela ${i + 1}/${input.totalParcelas})`,
      categoria: input.categoria,
      fornecedor_id: input.fornecedor_id,
      servico_id: input.servico_id,
      valor: input.valorParcela,
      data: dataParcela,
      status: i === 0 && input.primeiraPaga ? "realizado" : "previsto",
    };
  });

  const { error } = await supabase.from("lancamentos").insert(linhas);
  if (error) throw error;
  revalidateFinanceiroPaths();
  revalidatePath("/hoje");
}

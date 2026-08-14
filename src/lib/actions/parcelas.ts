"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { revalidateServicoPaths } from "./revalidateServicos";
import { revalidateFinanceiroPaths } from "./revalidateFinanceiro";

export interface ParcelaInput {
  descricao: string;
  valor_previsto: number;
  data_prevista: string | null;
}

async function recomputeValorPago(
  supabase: Awaited<ReturnType<typeof createClient>>,
  servicoId: string
) {
  const { data } = await supabase.from("servico_parcelas").select("valor_pago").eq("servico_id", servicoId);
  const total = (data ?? []).reduce((sum, p) => sum + (p.valor_pago ?? 0), 0);
  await supabase.from("servicos").update({ valor_pago: total }).eq("id", servicoId);
}

/** Semeia o par padrão Sinal (50%) + Restante (50%, na data do prazo) — ponto de partida rápido
 * pro caso mais comum; o usuário edita/adiciona parcelas depois se o combinado for diferente. */
export async function criarParcelasPadrao(servicoId: string) {
  const supabase = await createClient();
  const { data: sv, error: svErr } = await supabase
    .from("servicos")
    .select("valor, prazo")
    .eq("id", servicoId)
    .single();
  if (svErr || !sv) throw svErr ?? new Error("Serviço não encontrado.");

  const metade = Math.round((sv.valor / 2) * 100) / 100;
  const restante = Math.round((sv.valor - metade) * 100) / 100;

  const { error } = await supabase.from("servico_parcelas").insert([
    { servico_id: servicoId, ordem: 0, descricao: "Sinal (50%)", valor_previsto: metade, data_prevista: null },
    { servico_id: servicoId, ordem: 1, descricao: "Restante (50%)", valor_previsto: restante, data_prevista: sv.prazo },
  ]);
  if (error) throw error;
  revalidateServicoPaths();
}

export async function addParcela(servicoId: string, input: ParcelaInput, ordem: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("servico_parcelas").insert({
    servico_id: servicoId,
    ordem,
    descricao: input.descricao,
    valor_previsto: input.valor_previsto,
    data_prevista: input.data_prevista,
  });
  if (error) throw error;
  revalidateServicoPaths();
}

export async function updateParcela(parcelaId: string, input: ParcelaInput) {
  const supabase = await createClient();
  const { error } = await supabase.from("servico_parcelas").update(input).eq("id", parcelaId);
  if (error) throw error;
  revalidateServicoPaths();
}

export async function deleteParcela(parcelaId: string, servicoId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("servico_parcelas").delete().eq("id", parcelaId);
  if (error) throw error;
  await recomputeValorPago(supabase, servicoId);
  revalidateServicoPaths();
}

/**
 * Confirma o pagamento de uma parcela: grava valor/data reais (podem ser diferentes do
 * previsto — cliente manda um pouco mais ou menos), lança no Financeiro (ou confirma o
 * lançamento "previsto" que já existia pra essa parcela, em vez de duplicar), e — se houver uma
 * próxima parcela ainda sem lançamento — já cria o lançamento "previsto" dela, na data prevista
 * ou no prazo de entrega do serviço.
 */
export async function marcarParcelaPaga(
  parcelaId: string,
  servicoId: string,
  fields: { valorPago: number; dataPagamento: string; formaPagamento: string | null }
) {
  const supabase = await createClient();

  const { data: parcela, error: pErr } = await supabase
    .from("servico_parcelas")
    .select("*")
    .eq("id", parcelaId)
    .single();
  if (pErr || !parcela) throw pErr ?? new Error("Parcela não encontrada.");

  const { data: servico, error: sErr } = await supabase
    .from("servicos")
    .select("cliente, prazo")
    .eq("id", servicoId)
    .single();
  if (sErr || !servico) throw sErr ?? new Error("Serviço não encontrado.");

  let lancamentoId: string | null = parcela.lancamento_id;
  if (lancamentoId) {
    const { error: updLancErr } = await supabase
      .from("lancamentos")
      .update({
        valor: fields.valorPago,
        data: fields.dataPagamento,
        forma_pagamento: fields.formaPagamento,
        status: "realizado",
      })
      .eq("id", lancamentoId);
    if (updLancErr) throw updLancErr;
  } else {
    const { data: lanc, error: lancErr } = await supabase
      .from("lancamentos")
      .insert({
        tipo: "Receita",
        descricao: `${servico.cliente} — ${parcela.descricao}`,
        categoria: "Recebimento de serviço",
        valor: fields.valorPago,
        data: fields.dataPagamento,
        servico_id: servicoId,
        forma_pagamento: fields.formaPagamento,
        status: "realizado",
      })
      .select("id")
      .single();
    if (lancErr) throw lancErr;
    lancamentoId = lanc.id;
  }

  const { error: updErr } = await supabase
    .from("servico_parcelas")
    .update({
      valor_pago: fields.valorPago,
      pago_em: new Date().toISOString(),
      forma_pagamento: fields.formaPagamento,
      lancamento_id: lancamentoId,
    })
    .eq("id", parcelaId);
  if (updErr) throw updErr;

  await recomputeValorPago(supabase, servicoId);

  const { data: proxima } = await supabase
    .from("servico_parcelas")
    .select("*")
    .eq("servico_id", servicoId)
    .is("valor_pago", null)
    .is("lancamento_id", null)
    .gt("ordem", parcela.ordem)
    .order("ordem")
    .limit(1)
    .maybeSingle();

  if (proxima) {
    const { data: previstoLanc, error: prevErr } = await supabase
      .from("lancamentos")
      .insert({
        tipo: "Receita",
        descricao: `${servico.cliente} — ${proxima.descricao}`,
        categoria: "Recebimento de serviço",
        valor: proxima.valor_previsto,
        data: proxima.data_prevista ?? servico.prazo ?? fields.dataPagamento,
        servico_id: servicoId,
        status: "previsto",
      })
      .select("id")
      .single();
    if (!prevErr && previstoLanc) {
      await supabase.from("servico_parcelas").update({ lancamento_id: previstoLanc.id }).eq("id", proxima.id);
    }
  }

  revalidateServicoPaths();
  revalidateFinanceiroPaths();
  revalidatePath("/hoje");
}

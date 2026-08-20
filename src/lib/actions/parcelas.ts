"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/domain/dates";
import { revalidateServicoPaths } from "./revalidateServicos";
import { revalidateFinanceiroPaths } from "./revalidateFinanceiro";

export interface ParcelaInput {
  descricao: string;
  valor_previsto: number;
  data_prevista: string | null;
}

type SupabaseClientType = Awaited<ReturnType<typeof createClient>>;

/**
 * Além de recalcular o total pago, sobe o Status Financeiro pra "Pago" quando as parcelas
 * cobrem o valor total — sem isso o status ficava manual e desatualizado, travando o gate de
 * conclusão do Kanban ("Confirme a entrega e o financeiro") mesmo com tudo já recebido.
 */
async function recomputeValorPago(supabase: SupabaseClientType, servicoId: string) {
  const { data } = await supabase.from("servico_parcelas").select("valor_pago").eq("servico_id", servicoId);
  const total = (data ?? []).reduce((sum, p) => sum + (p.valor_pago ?? 0), 0);

  const { data: sv } = await supabase
    .from("servicos")
    .select("valor, financeiro_status")
    .eq("id", servicoId)
    .single();

  const fields: { valor_pago: number; financeiro_status?: string } = { valor_pago: total };
  if (
    sv &&
    sv.valor > 0 &&
    total >= sv.valor &&
    !["Pago", "Cortesia", "Cancelado"].includes(sv.financeiro_status)
  ) {
    fields.financeiro_status = "Pago";
  }
  await supabase.from("servicos").update(fields).eq("id", servicoId);
}

/**
 * Cria uma ou mais parcelas e já lança cada uma como "previsto" no Financeiro (recebíveis),
 * com a data prevista de cada uma (ou o prazo de entrega do serviço, se a parcela não tiver
 * data própria) — dá visibilidade do plano de pagamento inteiro assim que ele é combinado,
 * não só da próxima parcela.
 */
async function criarParcelasComLancamento(servicoId: string, itens: ParcelaInput[], ordemInicial = 0) {
  if (itens.length === 0) return;
  const supabase = await createClient();

  const { data: sv, error: svErr } = await supabase
    .from("servicos")
    .select("cliente, prazo")
    .eq("id", servicoId)
    .single();
  if (svErr || !sv) throw svErr ?? new Error("Serviço não encontrado.");

  const { data: inseridas, error: insErr } = await supabase
    .from("servico_parcelas")
    .insert(
      itens.map((item, i) => ({
        servico_id: servicoId,
        ordem: ordemInicial + i,
        descricao: item.descricao,
        valor_previsto: item.valor_previsto,
        data_prevista: item.data_prevista,
      }))
    )
    .select("id, descricao, valor_previsto, data_prevista");
  if (insErr) throw insErr;

  const hoje = new Date().toISOString().slice(0, 10);
  for (const p of inseridas ?? []) {
    const { data: lanc, error: lancErr } = await supabase
      .from("lancamentos")
      .insert({
        tipo: "Receita",
        descricao: `${sv.cliente} — ${p.descricao}`,
        categoria: "Recebimento de serviço",
        valor: p.valor_previsto,
        data: p.data_prevista ?? sv.prazo ?? hoje,
        servico_id: servicoId,
        status: "previsto",
      })
      .select("id")
      .single();
    if (lancErr) throw lancErr;
    await supabase.from("servico_parcelas").update({ lancamento_id: lanc.id }).eq("id", p.id);
  }

  revalidateServicoPaths();
  revalidateFinanceiroPaths();
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

  await criarParcelasComLancamento(servicoId, [
    { descricao: "Sinal (50%)", valor_previsto: metade, data_prevista: todayISO() },
    { descricao: "Restante (50%)", valor_previsto: restante, data_prevista: sv.prazo },
  ]);
}

/** Cliente pagou (ou vai pagar) tudo de uma vez — uma parcela só, no valor cheio do serviço. */
export async function criarParcelaAvista(servicoId: string) {
  const supabase = await createClient();
  const { data: sv, error: svErr } = await supabase
    .from("servicos")
    .select("valor, prazo")
    .eq("id", servicoId)
    .single();
  if (svErr || !sv) throw svErr ?? new Error("Serviço não encontrado.");

  await criarParcelasComLancamento(servicoId, [
    { descricao: "Pagamento integral (à vista)", valor_previsto: sv.valor, data_prevista: sv.prazo },
  ]);
}

/** Cria várias parcelas de uma vez (fluxo "Personalizar") — usado quando o combinado não é o
 * padrão 50/50 nem um pagamento único: número de parcelas, valor e data de cada uma à mão. */
export async function criarParcelasPersonalizadas(servicoId: string, itens: ParcelaInput[]) {
  await criarParcelasComLancamento(servicoId, itens);
}

/** Adiciona uma parcela extra a um plano de pagamento que já existe. */
export async function addParcela(servicoId: string, input: ParcelaInput, ordem: number) {
  await criarParcelasComLancamento(servicoId, [input], ordem);
}

export async function updateParcela(parcelaId: string, input: ParcelaInput) {
  const supabase = await createClient();
  const { error } = await supabase.from("servico_parcelas").update(input).eq("id", parcelaId);
  if (error) throw error;
  revalidateServicoPaths();
}

export async function deleteParcela(parcelaId: string, servicoId: string) {
  const supabase = await createClient();
  const { data: parcela } = await supabase
    .from("servico_parcelas")
    .select("lancamento_id")
    .eq("id", parcelaId)
    .single();

  const { error } = await supabase.from("servico_parcelas").delete().eq("id", parcelaId);
  if (error) throw error;

  // Sem isso, o "previsto" que essa parcela gerou no Financeiro ficava órfão — visível em
  // Lançamentos como se ainda fosse receber, mesmo depois de a parcela ter sido apagada aqui.
  if (parcela?.lancamento_id) {
    await supabase.from("lancamentos").delete().eq("id", parcela.lancamento_id);
  }

  await recomputeValorPago(supabase, servicoId);
  revalidateServicoPaths();
  revalidateFinanceiroPaths();
}

/**
 * Reabre o plano de parcelas pra edição em bloco: apaga as parcelas ainda não pagas (e os
 * "previsto" que elas geraram no Financeiro) e recria com a configuração nova — sem mexer nas
 * que já foram pagas, pra não perder histórico de recebimento.
 */
export async function reconfigurarParcelasPendentes(servicoId: string, itens: ParcelaInput[]) {
  const supabase = await createClient();

  const { data: pendentes } = await supabase
    .from("servico_parcelas")
    .select("id, ordem, lancamento_id")
    .eq("servico_id", servicoId)
    .is("valor_pago", null);

  const lista = pendentes ?? [];
  if (lista.length > 0) {
    const { error: delErr } = await supabase
      .from("servico_parcelas")
      .delete()
      .in(
        "id",
        lista.map((p) => p.id)
      );
    if (delErr) throw delErr;

    const lancamentoIds = lista.map((p) => p.lancamento_id).filter((id): id is string => !!id);
    if (lancamentoIds.length > 0) {
      await supabase.from("lancamentos").delete().in("id", lancamentoIds);
    }
  }

  const { data: restantes } = await supabase
    .from("servico_parcelas")
    .select("ordem")
    .eq("servico_id", servicoId)
    .order("ordem", { ascending: false })
    .limit(1);
  const ordemInicial = (restantes?.[0]?.ordem ?? -1) + 1;

  await criarParcelasComLancamento(servicoId, itens, ordemInicial);
  await recomputeValorPago(supabase, servicoId);
}

/**
 * Confirma o pagamento de uma parcela: grava valor/data reais (podem ser diferentes do
 * previsto — cliente manda um pouco mais ou menos) e confirma o lançamento "previsto" que já
 * existia pra essa parcela (criado no momento em que a parcela foi lançada), virando
 * "realizado" com o valor/data reais em vez de duplicar o lançamento.
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
    // Parcela antiga, de antes desse lançamento automático existir — cria agora, na hora de pagar.
    const { data: servico, error: sErr } = await supabase
      .from("servicos")
      .select("cliente")
      .eq("id", servicoId)
      .single();
    if (sErr || !servico) throw sErr ?? new Error("Serviço não encontrado.");

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

  revalidateServicoPaths();
  revalidateFinanceiroPaths();
  revalidatePath("/hoje");
}

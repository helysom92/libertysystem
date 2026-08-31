"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/domain/dates";
import { revalidateServicoPaths } from "./revalidateServicos";
import { revalidateFinanceiroPaths } from "./revalidateFinanceiro";
import { requireRole } from "@/lib/domain/permissions";
import type { AcaoResultado, AcaoComSaldo } from "./resultado";

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
async function criarParcelasComLancamento(servicoId: string, itens: ParcelaInput[], ordemInicial = 0): Promise<AcaoResultado> {
  if (itens.length === 0) return { ok: true };
  const supabase = await createClient();

  const { data: sv, error: svErr } = await supabase
    .from("servicos")
    .select("cliente, prazo")
    .eq("id", servicoId)
    .single();
  if (svErr || !sv) return { ok: false, message: svErr?.message ?? "Serviço não encontrado." };

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
  if (insErr) return { ok: false, message: insErr.message };

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
    if (lancErr) return { ok: false, message: lancErr.message };
    await supabase.from("servico_parcelas").update({ lancamento_id: lanc.id }).eq("id", p.id);
  }

  revalidateServicoPaths();
  revalidateFinanceiroPaths();
  return { ok: true };
}

/** Semeia o par padrão Sinal (50%) + Restante (50%, na data do prazo) — ponto de partida rápido
 * pro caso mais comum; o usuário edita/adiciona parcelas depois se o combinado for diferente. */
export async function criarParcelasPadrao(servicoId: string): Promise<AcaoResultado> {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { data: sv, error: svErr } = await supabase
    .from("servicos")
    .select("valor, prazo")
    .eq("id", servicoId)
    .single();
  if (svErr || !sv) return { ok: false, message: svErr?.message ?? "Serviço não encontrado." };

  const metade = Math.round((sv.valor / 2) * 100) / 100;
  const restante = Math.round((sv.valor - metade) * 100) / 100;

  return criarParcelasComLancamento(servicoId, [
    { descricao: "Sinal (50%)", valor_previsto: metade, data_prevista: todayISO() },
    { descricao: "Restante (50%)", valor_previsto: restante, data_prevista: sv.prazo },
  ]);
}

/** Cliente pagou (ou vai pagar) tudo de uma vez — uma parcela só, no valor cheio do serviço. */
export async function criarParcelaAvista(servicoId: string): Promise<AcaoResultado> {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { data: sv, error: svErr } = await supabase
    .from("servicos")
    .select("valor, prazo")
    .eq("id", servicoId)
    .single();
  if (svErr || !sv) return { ok: false, message: svErr?.message ?? "Serviço não encontrado." };

  return criarParcelasComLancamento(servicoId, [
    { descricao: "Pagamento integral (à vista)", valor_previsto: sv.valor, data_prevista: sv.prazo },
  ]);
}

/** Cria várias parcelas de uma vez (fluxo "Personalizar") — usado quando o combinado não é o
 * padrão 50/50 nem um pagamento único: número de parcelas, valor e data de cada uma à mão. */
export async function criarParcelasPersonalizadas(servicoId: string, itens: ParcelaInput[]): Promise<AcaoResultado> {
  await requireRole("administrador", "secretaria");
  return criarParcelasComLancamento(servicoId, itens);
}

/** Adiciona uma parcela extra a um plano de pagamento que já existe. */
export async function addParcela(servicoId: string, input: ParcelaInput, ordem: number): Promise<AcaoResultado> {
  await requireRole("administrador", "secretaria");
  return criarParcelasComLancamento(servicoId, [input], ordem);
}

export async function updateParcela(parcelaId: string, input: ParcelaInput): Promise<AcaoResultado> {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { error } = await supabase.from("servico_parcelas").update(input).eq("id", parcelaId);
  if (error) return { ok: false, message: error.message };
  revalidateServicoPaths();
  return { ok: true };
}

export async function deleteParcela(parcelaId: string, servicoId: string): Promise<AcaoResultado> {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { data: parcela } = await supabase
    .from("servico_parcelas")
    .select("lancamento_id")
    .eq("id", parcelaId)
    .single();

  const { error } = await supabase.from("servico_parcelas").delete().eq("id", parcelaId);
  if (error) return { ok: false, message: error.message };

  // Sem isso, o "previsto" que essa parcela gerou no Financeiro ficava órfão — visível em
  // Lançamentos como se ainda fosse receber, mesmo depois de a parcela ter sido apagada aqui.
  if (parcela?.lancamento_id) {
    await supabase.from("lancamentos").delete().eq("id", parcela.lancamento_id);
  }

  await recomputeValorPago(supabase, servicoId);
  revalidateServicoPaths();
  revalidateFinanceiroPaths();
  return { ok: true };
}

/**
 * Reabre o plano de parcelas pra edição em bloco: apaga as parcelas ainda não pagas (e os
 * "previsto" que elas geraram no Financeiro) e recria com a configuração nova — sem mexer nas
 * que já foram pagas, pra não perder histórico de recebimento.
 */
export async function reconfigurarParcelasPendentes(servicoId: string, itens: ParcelaInput[]): Promise<AcaoResultado> {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();

  const { data: pendentes } = await supabase
    .from("servico_parcelas")
    .select("id, ordem, lancamento_id")
    .eq("servico_id", servicoId)
    .is("valor_pago", null)
    .is("cancelada_em", null);

  const lista = pendentes ?? [];
  if (lista.length > 0) {
    const { error: delErr } = await supabase
      .from("servico_parcelas")
      .delete()
      .in(
        "id",
        lista.map((p) => p.id)
      );
    if (delErr) return { ok: false, message: delErr.message };

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

  const resultado = await criarParcelasComLancamento(servicoId, itens, ordemInicial);
  if (!resultado.ok) return resultado;
  await recomputeValorPago(supabase, servicoId);
  return { ok: true };
}

/**
 * Confirma um recebimento (total ou parcial) de uma parcela. `valorRecebidoAgora` é o valor
 * que está entrando NESTA confirmação — não o total acumulado. Correção pontual pós-Etapa-3:
 * agora é uma RPC atômica (`registrar_recebimento_parcela`, migration 0037) que trava a linha
 * da parcela, recalcula o saldo a partir do ledger `parcela_recebimentos` (não mais um único
 * `valor_pago` acumulado — isso é o que permite depois estornar UM recebimento específico sem
 * mexer nos outros) e **bloqueia de verdade** um valor maior que o saldo em aberto — antes só
 * avisava e deixava passar, o que contraria a regra de nunca permitir saldo negativo.
 */
export async function marcarParcelaPaga(
  parcelaId: string,
  servicoId: string,
  fields: { valorRecebidoAgora: number; dataPagamento: string; formaPagamento: string | null }
): Promise<AcaoComSaldo> {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("registrar_recebimento_parcela", {
    p_parcela_id: parcelaId,
    p_valor: fields.valorRecebidoAgora,
    p_data: fields.dataPagamento,
    p_forma_pagamento: fields.formaPagamento,
  });
  if (error) return { ok: false, message: error.message };
  const resultado = data as { ok: boolean; reason?: string; saldoRestante?: number };
  if (!resultado.ok) return { ok: false, message: resultado.reason ?? "Não foi possível registrar esse recebimento." };

  await recomputeValorPago(supabase, servicoId);
  revalidateServicoPaths();
  revalidateFinanceiroPaths();
  revalidatePath("/hoje");

  return { ok: true, saldoRestante: resultado.saldoRestante ?? 0 };
}

/** Lista cada recebimento individual de uma parcela (ledger `parcela_recebimentos`), mais
 * recente primeiro — alimenta o histórico com estorno por linha na tela de pagamentos. */
export async function listarRecebimentosDaParcela(parcelaId: string) {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("parcela_recebimentos")
    .select("*")
    .eq("parcela_id", parcelaId)
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Cancela uma parcela específica (o cliente não vai mais pagar essa parte) sem apagar o
 * registro — sai de "A Receber" dali pra frente, mas continua visível na aba Cancelados.
 * Bloqueia cancelar uma parcela que já tem recebimento — estorne o recebimento primeiro, pra
 * não deixar dinheiro já recebido "escondido" atrás de uma parcela marcada como cancelada. */
export async function cancelarParcela(parcelaId: string, motivo: string | null): Promise<AcaoResultado> {
  const profile = await requireRole("administrador", "secretaria");
  const supabase = await createClient();

  const { data: parcela } = await supabase.from("servico_parcelas").select("valor_pago").eq("id", parcelaId).single();
  if (parcela?.valor_pago != null && parcela.valor_pago > 0) {
    return { ok: false, message: "Essa parcela já tem recebimento — estorne o recebimento antes de cancelar." };
  }

  const { error } = await supabase
    .from("servico_parcelas")
    .update({ cancelada_em: new Date().toISOString(), cancelada_por: profile.id, motivo_cancelamento: motivo })
    .eq("id", parcelaId);
  if (error) return { ok: false, message: error.message };

  await supabase.from("financeiro_eventos").insert({
    entidade: "parcela",
    entidade_id: parcelaId,
    evento: "cancelamento",
    motivo,
    usuario_id: profile.id,
  });

  revalidateServicoPaths();
  revalidateFinanceiroPaths();
  return { ok: true };
}

/** Estorna UM recebimento específico (não a parcela inteira) — os demais recebimentos da mesma
 * parcela continuam intactos. Atômico via RPC `estornar_recebimento_parcela` (migration 0037):
 * marca a linha do ledger como estornada, cancela (não reabre como "previsto") o lançamento
 * daquele recebimento específico, e recalcula `valor_pago` da parcela a partir da soma dos
 * recebimentos ainda válidos. Impede estornar o mesmo recebimento duas vezes. */
export async function estornarRecebimentoParcela(recebimentoId: string, servicoId: string, motivo: string | null): Promise<AcaoResultado> {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("estornar_recebimento_parcela", {
    p_recebimento_id: recebimentoId,
    p_motivo: motivo,
  });
  if (error) return { ok: false, message: error.message };
  const resultado = data as { ok: boolean; reason?: string };
  if (!resultado.ok) return { ok: false, message: resultado.reason ?? "Não foi possível estornar esse recebimento." };

  await recomputeValorPago(supabase, servicoId);
  revalidateServicoPaths();
  revalidateFinanceiroPaths();
  revalidatePath("/hoje");
  return { ok: true };
}

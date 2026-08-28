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

/** Cancela um lançamento avulso sem apagar o registro (Etapa 3) — `recebido`/`despesasPagas`/
 * `aReceber`/`aPagar` (financas.ts) já filtram por status='realizado'/'previsto', então um
 * lançamento cancelado sai sozinho de todos os totais, sem precisar tocar em nenhuma fórmula. */
export async function cancelarLancamento(id: string, motivo: string | null) {
  const profile = await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { error } = await supabase.from("lancamentos").update({ status: "cancelado" }).eq("id", id);
  if (error) throw error;
  await supabase.from("financeiro_eventos").insert({
    entidade: "lancamento",
    entidade_id: id,
    evento: "cancelamento",
    motivo,
    usuario_id: profile.id,
  });
  revalidateFinanceiroPaths();
  revalidatePath("/hoje");
}

/** Reverte um lançamento marcado como realizado por engano — volta a "previsto", preserva o
 * registro. Não usar pra reverter cancelamento (use `createLancamento`/edite o status na hora
 * de corrigir, já que cancelar é uma decisão de negócio diferente de "baixa errada"). */
export async function estornarLancamento(id: string, motivo: string | null) {
  const profile = await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { data: atual } = await supabase.from("lancamentos").select("valor,status").eq("id", id).single();
  if (!atual || atual.status !== "realizado") {
    throw new Error("Só é possível estornar um lançamento que já foi realizado.");
  }
  const { error } = await supabase.from("lancamentos").update({ status: "previsto" }).eq("id", id);
  if (error) throw error;
  await supabase.from("financeiro_eventos").insert({
    entidade: "lancamento",
    entidade_id: id,
    evento: "estorno",
    valor_anterior: atual.valor,
    valor_novo: atual.valor,
    motivo,
    usuario_id: profile.id,
  });
  revalidateFinanceiroPaths();
  revalidatePath("/hoje");
}

/** Histórico de eventos (pagamento/cancelamento/estorno) de um registro específico — alimenta
 * "consultar histórico de recebimentos/pagamentos" em Recebimentos e Despesas. */
export async function historicoDoRegistro(
  entidade: "lancamento" | "parcela" | "despesa_fixa_ocorrencia" | "despesa_variavel_ocorrencia",
  entidadeId: string
) {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("financeiro_eventos")
    .select("*")
    .eq("entidade", entidade)
    .eq("entidade_id", entidadeId)
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return data ?? [];
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

/** Cancela só a ocorrência deste mês (o cliente/fornecedor não vai cobrar/pagar esse mês
 * específico) — sem desativar a regra recorrente inteira, que continua gerando os meses
 * seguintes normalmente. */
export async function cancelarOcorrenciaDespesaFixa(despesaFixaId: string, ano: number, mes: number, motivo: string | null) {
  const profile = await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  await supabase
    .from("despesas_fixas_ocorrencias")
    .upsert({ despesa_fixa_id: despesaFixaId, ano, mes, pago: false }, { onConflict: "despesa_fixa_id,ano,mes" });
  const { data: ocorrencia, error } = await supabase
    .from("despesas_fixas_ocorrencias")
    .update({ cancelada_em: new Date().toISOString(), cancelada_por: profile.id, motivo_cancelamento: motivo })
    .eq("despesa_fixa_id", despesaFixaId)
    .eq("ano", ano)
    .eq("mes", mes)
    .select("id")
    .single();
  if (error) throw error;
  await supabase.from("financeiro_eventos").insert({
    entidade: "despesa_fixa_ocorrencia",
    entidade_id: ocorrencia.id,
    evento: "cancelamento",
    motivo,
    usuario_id: profile.id,
  });
  revalidateFinanceiroPaths();
}

/** Estorna o pagamento de uma ocorrência de despesa fixa — reaproveita a RPC atômica já
 * existente (migration 0035, `pago=false`, que já reverte/apaga o lançamento vinculado com
 * segurança contra clique duplo) e só registra o evento de auditoria por cima, sem editar a
 * migration antiga. */
export async function estornarPagamentoOcorrenciaDespesaFixa(despesaFixaId: string, ano: number, mes: number, motivo: string | null) {
  const profile = await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { data: antes } = await supabase
    .from("despesas_fixas_ocorrencias")
    .select("id, lancamento_id")
    .eq("despesa_fixa_id", despesaFixaId)
    .eq("ano", ano)
    .eq("mes", mes)
    .maybeSingle();
  if (!antes?.lancamento_id) throw new Error("Essa ocorrência não tem pagamento pra estornar.");
  const { data: lanc } = await supabase.from("lancamentos").select("valor").eq("id", antes.lancamento_id).single();

  const { error } = await supabase.rpc("toggle_despesa_fixa_ocorrencia", {
    p_despesa_fixa_id: despesaFixaId,
    p_ano: ano,
    p_mes: mes,
    p_pago: false,
  });
  if (error) throw error;

  await supabase.from("financeiro_eventos").insert({
    entidade: "despesa_fixa_ocorrencia",
    entidade_id: antes.id,
    evento: "estorno",
    valor_anterior: lanc?.valor ?? null,
    valor_novo: null,
    motivo,
    usuario_id: profile.id,
  });
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

/** Espelha `cancelarOcorrenciaDespesaFixa`, pro lado das despesas variáveis. */
export async function cancelarOcorrenciaDespesaVariavel(despesaVariavelId: string, ano: number, mes: number, motivo: string | null) {
  const profile = await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  await supabase
    .from("despesas_variaveis_ocorrencias")
    .upsert({ despesa_variavel_id: despesaVariavelId, ano, mes, pago: false }, { onConflict: "despesa_variavel_id,ano,mes" });
  const { data: ocorrencia, error } = await supabase
    .from("despesas_variaveis_ocorrencias")
    .update({ cancelada_em: new Date().toISOString(), cancelada_por: profile.id, motivo_cancelamento: motivo })
    .eq("despesa_variavel_id", despesaVariavelId)
    .eq("ano", ano)
    .eq("mes", mes)
    .select("id")
    .single();
  if (error) throw error;
  await supabase.from("financeiro_eventos").insert({
    entidade: "despesa_variavel_ocorrencia",
    entidade_id: ocorrencia.id,
    evento: "cancelamento",
    motivo,
    usuario_id: profile.id,
  });
  revalidateFinanceiroPaths();
}

/** Espelha `estornarPagamentoOcorrenciaDespesaFixa`, pro lado das despesas variáveis. */
export async function estornarPagamentoOcorrenciaDespesaVariavel(despesaVariavelId: string, ano: number, mes: number, motivo: string | null) {
  const profile = await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { data: antes } = await supabase
    .from("despesas_variaveis_ocorrencias")
    .select("id, lancamento_id")
    .eq("despesa_variavel_id", despesaVariavelId)
    .eq("ano", ano)
    .eq("mes", mes)
    .maybeSingle();
  if (!antes?.lancamento_id) throw new Error("Essa ocorrência não tem pagamento pra estornar.");
  const { data: lanc } = await supabase.from("lancamentos").select("valor").eq("id", antes.lancamento_id).single();

  const { error } = await supabase.rpc("toggle_despesa_variavel_ocorrencia", {
    p_despesa_variavel_id: despesaVariavelId,
    p_ano: ano,
    p_mes: mes,
    p_pago: false,
  });
  if (error) throw error;

  await supabase.from("financeiro_eventos").insert({
    entidade: "despesa_variavel_ocorrencia",
    entidade_id: antes.id,
    evento: "estorno",
    valor_anterior: lanc?.valor ?? null,
    valor_novo: null,
    motivo,
    usuario_id: profile.id,
  });
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

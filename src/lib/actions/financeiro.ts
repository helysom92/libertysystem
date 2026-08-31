"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { revalidateFinanceiroPaths } from "./revalidateFinanceiro";
import { requireRole } from "@/lib/domain/permissions";
import type { AcaoResultado, AcaoComSaldo } from "./resultado";

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

export async function createLancamento(input: NovoLancamentoInput): Promise<AcaoResultado> {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { error } = await supabase.from("lancamentos").insert(input);
  if (error) return { ok: false, message: error.message };
  revalidateFinanceiroPaths();
  revalidatePath("/hoje");
  return { ok: true };
}

export async function marcarLancamentoRealizado(id: string): Promise<AcaoResultado> {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { error } = await supabase.from("lancamentos").update({ status: "realizado" }).eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateFinanceiroPaths();
  revalidatePath("/hoje");
  return { ok: true };
}

export async function updateLancamento(id: string, input: NovoLancamentoInput): Promise<AcaoResultado> {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { error } = await supabase.from("lancamentos").update(input).eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateFinanceiroPaths();
  revalidatePath("/hoje");
  return { ok: true };
}

export async function deleteLancamento(id: string): Promise<AcaoResultado> {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { error } = await supabase.from("lancamentos").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateFinanceiroPaths();
  revalidatePath("/hoje");
  return { ok: true };
}

/** Cancela um lançamento avulso sem apagar o registro (Etapa 3) — `recebido`/`despesasPagas`/
 * `aReceber`/`aPagar` (financas.ts) já filtram por status='realizado'/'previsto', então um
 * lançamento cancelado sai sozinho de todos os totais, sem precisar tocar em nenhuma fórmula. */
export async function cancelarLancamento(id: string, motivo: string | null): Promise<AcaoResultado> {
  const profile = await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { error } = await supabase.from("lancamentos").update({ status: "cancelado" }).eq("id", id);
  if (error) return { ok: false, message: error.message };
  await supabase.from("financeiro_eventos").insert({
    entidade: "lancamento",
    entidade_id: id,
    evento: "cancelamento",
    motivo,
    usuario_id: profile.id,
  });
  revalidateFinanceiroPaths();
  revalidatePath("/hoje");
  return { ok: true };
}

/** Reverte um lançamento marcado como realizado por engano — volta a "previsto", preserva o
 * registro. Não usar pra reverter cancelamento (use `createLancamento`/edite o status na hora
 * de corrigir, já que cancelar é uma decisão de negócio diferente de "baixa errada"). */
export async function estornarLancamento(id: string, motivo: string | null): Promise<AcaoResultado> {
  const profile = await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { data: atual } = await supabase.from("lancamentos").select("valor,status").eq("id", id).single();
  if (!atual || atual.status !== "realizado") {
    return { ok: false, message: "Só é possível estornar um lançamento que já foi realizado." };
  }
  const { error } = await supabase.from("lancamentos").update({ status: "previsto" }).eq("id", id);
  if (error) return { ok: false, message: error.message };
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
  return { ok: true };
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

export async function createDespesaFixa(input: NovaDespesaFixaInput): Promise<AcaoResultado> {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { error } = await supabase.from("despesas_fixas").insert(input);
  if (error) return { ok: false, message: error.message };
  revalidateFinanceiroPaths();
  return { ok: true };
}

export async function updateDespesaFixa(id: string, input: NovaDespesaFixaInput): Promise<AcaoResultado> {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { error } = await supabase.from("despesas_fixas").update(input).eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateFinanceiroPaths();
  return { ok: true };
}

export async function deleteDespesaFixa(id: string): Promise<AcaoResultado> {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { error } = await supabase.from("despesas_fixas").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateFinanceiroPaths();
  return { ok: true };
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
): Promise<AcaoResultado> {
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
  if (error) return { ok: false, message: error.message };
  revalidateFinanceiroPaths();
  revalidatePath("/hoje");
  return { ok: true };
}

/** Cancela só a ocorrência deste mês (o cliente/fornecedor não vai cobrar/pagar esse mês
 * específico) — sem desativar a regra recorrente inteira, que continua gerando os meses
 * seguintes normalmente. */
export async function cancelarOcorrenciaDespesaFixa(
  despesaFixaId: string,
  ano: number,
  mes: number,
  motivo: string | null
): Promise<AcaoResultado> {
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
  if (error) return { ok: false, message: error.message };
  await supabase.from("financeiro_eventos").insert({
    entidade: "despesa_fixa_ocorrencia",
    entidade_id: ocorrencia.id,
    evento: "cancelamento",
    motivo,
    usuario_id: profile.id,
  });
  revalidateFinanceiroPaths();
  return { ok: true };
}

/** Estorna o pagamento de uma ocorrência de despesa fixa — reaproveita a RPC atômica já
 * existente (migration 0035, `pago=false`, que já reverte/apaga o lançamento vinculado com
 * segurança contra clique duplo) e só registra o evento de auditoria por cima, sem editar a
 * migration antiga. */
export async function estornarPagamentoOcorrenciaDespesaFixa(
  despesaFixaId: string,
  ano: number,
  mes: number,
  motivo: string | null
): Promise<AcaoResultado> {
  const profile = await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { data: antes } = await supabase
    .from("despesas_fixas_ocorrencias")
    .select("id, lancamento_id")
    .eq("despesa_fixa_id", despesaFixaId)
    .eq("ano", ano)
    .eq("mes", mes)
    .maybeSingle();
  if (!antes?.lancamento_id) return { ok: false, message: "Essa ocorrência não tem pagamento pra estornar." };
  const { data: lanc } = await supabase.from("lancamentos").select("valor").eq("id", antes.lancamento_id).single();

  const { error } = await supabase.rpc("toggle_despesa_fixa_ocorrencia", {
    p_despesa_fixa_id: despesaFixaId,
    p_ano: ano,
    p_mes: mes,
    p_pago: false,
  });
  if (error) return { ok: false, message: error.message };

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
  return { ok: true };
}

/**
 * Registra um pagamento (total ou parcial) de uma ocorrência de despesa fixa. Correção pontual
 * pós-Etapa-3: antes `pago` era binário (sem forma de pagar só uma parte da conta); agora é
 * uma RPC atômica (`registrar_pagamento_despesa_fixa_ocorrencia`, migration 0037) que trava a
 * linha, soma a partir do ledger `despesa_ocorrencia_pagamentos` (não mais um valor único) e
 * **bloqueia de verdade** um valor maior que o saldo em aberto.
 */
export async function registrarPagamentoDespesaFixaOcorrencia(
  despesaFixaId: string,
  ano: number,
  mes: number,
  valor: number,
  data: string
): Promise<AcaoComSaldo> {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { data: resultado, error } = await supabase.rpc("registrar_pagamento_despesa_fixa_ocorrencia", {
    p_despesa_fixa_id: despesaFixaId,
    p_ano: ano,
    p_mes: mes,
    p_valor: valor,
    p_data: data,
  });
  if (error) return { ok: false, message: error.message };
  const r = resultado as { ok: boolean; reason?: string; saldoRestante?: number };
  if (!r.ok) return { ok: false, message: r.reason ?? "Não foi possível registrar esse pagamento." };
  revalidateFinanceiroPaths();
  revalidatePath("/hoje");
  return { ok: true, saldoRestante: r.saldoRestante ?? 0 };
}

/** Espelha `registrarPagamentoDespesaFixaOcorrencia`, pro lado das despesas variáveis. */
export async function registrarPagamentoDespesaVariavelOcorrencia(
  despesaVariavelId: string,
  ano: number,
  mes: number,
  valor: number,
  data: string
): Promise<AcaoComSaldo> {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { data: resultado, error } = await supabase.rpc("registrar_pagamento_despesa_variavel_ocorrencia", {
    p_despesa_variavel_id: despesaVariavelId,
    p_ano: ano,
    p_mes: mes,
    p_valor: valor,
    p_data: data,
  });
  if (error) return { ok: false, message: error.message };
  const r = resultado as { ok: boolean; reason?: string; saldoRestante?: number };
  if (!r.ok) return { ok: false, message: r.reason ?? "Não foi possível registrar esse pagamento." };
  revalidateFinanceiroPaths();
  revalidatePath("/hoje");
  return { ok: true, saldoRestante: r.saldoRestante ?? 0 };
}

/** Lista cada pagamento individual de uma ocorrência de despesa (fixa ou variável), mais
 * recente primeiro — alimenta o histórico com estorno por linha. */
export async function listarPagamentosDespesaOcorrencia(
  entidade: "despesa_fixa_ocorrencia" | "despesa_variavel_ocorrencia",
  ocorrenciaId: string
) {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("despesa_ocorrencia_pagamentos")
    .select("*")
    .eq("entidade", entidade)
    .eq("ocorrencia_id", ocorrenciaId)
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Estorna UM pagamento específico de uma ocorrência de despesa — os demais pagamentos da
 * mesma ocorrência (se houver) continuam intactos. Espelha `estornarRecebimentoParcela`. */
export async function estornarPagamentoDespesaOcorrencia(
  entidade: "despesa_fixa_ocorrencia" | "despesa_variavel_ocorrencia",
  pagamentoId: string,
  motivo: string | null
): Promise<AcaoResultado> {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const rpcName =
    entidade === "despesa_fixa_ocorrencia"
      ? "estornar_pagamento_despesa_fixa_ocorrencia"
      : "estornar_pagamento_despesa_variavel_ocorrencia";
  const { data, error } = await supabase.rpc(rpcName, { p_pagamento_id: pagamentoId, p_motivo: motivo });
  if (error) return { ok: false, message: error.message };
  const r = data as { ok: boolean; reason?: string };
  if (!r.ok) return { ok: false, message: r.reason ?? "Não foi possível estornar esse pagamento." };
  revalidateFinanceiroPaths();
  revalidatePath("/hoje");
  return { ok: true };
}

export interface NovaDespesaVariavelInput {
  descricao: string;
  valor_provisionado: number;
  categoria: string;
  fornecedor_id?: string | null;
  data?: string | null;
}

export async function createDespesaVariavel(input: NovaDespesaVariavelInput): Promise<AcaoResultado> {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { error } = await supabase.from("despesas_variaveis").insert(input);
  if (error) return { ok: false, message: error.message };
  revalidateFinanceiroPaths();
  return { ok: true };
}

export async function updateDespesaVariavel(id: string, input: NovaDespesaVariavelInput): Promise<AcaoResultado> {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { error } = await supabase.from("despesas_variaveis").update(input).eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateFinanceiroPaths();
  return { ok: true };
}

export async function deleteDespesaVariavel(id: string): Promise<AcaoResultado> {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { error } = await supabase.from("despesas_variaveis").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateFinanceiroPaths();
  return { ok: true };
}

export async function updateDespesaVariavelValor(
  despesaVariavelId: string,
  ano: number,
  mes: number,
  valorReal: number
): Promise<AcaoResultado> {
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
  if (error) return { ok: false, message: error.message };

  // Se essa ocorrência já estava paga (com lançamento vinculado), mantém o valor do
  // lançamento em sincronia com o valor real editado — evita duas fontes de verdade divergindo.
  if (existente?.lancamento_id) {
    await supabase.from("lancamentos").update({ valor: valorReal }).eq("id", existente.lancamento_id);
  }

  revalidateFinanceiroPaths();
  return { ok: true };
}

/** Mesma sincronia de `toggleDespesaOcorrencia`, pro lado das despesas variáveis. */
export async function toggleDespesaVariavelPago(
  despesaVariavelId: string,
  ano: number,
  mes: number,
  pago: boolean
): Promise<AcaoResultado> {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  // RPC atômica (migration 0035) — mesma correção de corrida do lado fixo.
  const { error } = await supabase.rpc("toggle_despesa_variavel_ocorrencia", {
    p_despesa_variavel_id: despesaVariavelId,
    p_ano: ano,
    p_mes: mes,
    p_pago: pago,
  });
  if (error) return { ok: false, message: error.message };
  revalidateFinanceiroPaths();
  revalidatePath("/hoje");
  return { ok: true };
}

/** Espelha `cancelarOcorrenciaDespesaFixa`, pro lado das despesas variáveis. */
export async function cancelarOcorrenciaDespesaVariavel(
  despesaVariavelId: string,
  ano: number,
  mes: number,
  motivo: string | null
): Promise<AcaoResultado> {
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
  if (error) return { ok: false, message: error.message };
  await supabase.from("financeiro_eventos").insert({
    entidade: "despesa_variavel_ocorrencia",
    entidade_id: ocorrencia.id,
    evento: "cancelamento",
    motivo,
    usuario_id: profile.id,
  });
  revalidateFinanceiroPaths();
  return { ok: true };
}

/** Espelha `estornarPagamentoOcorrenciaDespesaFixa`, pro lado das despesas variáveis. */
export async function estornarPagamentoOcorrenciaDespesaVariavel(
  despesaVariavelId: string,
  ano: number,
  mes: number,
  motivo: string | null
): Promise<AcaoResultado> {
  const profile = await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { data: antes } = await supabase
    .from("despesas_variaveis_ocorrencias")
    .select("id, lancamento_id")
    .eq("despesa_variavel_id", despesaVariavelId)
    .eq("ano", ano)
    .eq("mes", mes)
    .maybeSingle();
  if (!antes?.lancamento_id) return { ok: false, message: "Essa ocorrência não tem pagamento pra estornar." };
  const { data: lanc } = await supabase.from("lancamentos").select("valor").eq("id", antes.lancamento_id).single();

  const { error } = await supabase.rpc("toggle_despesa_variavel_ocorrencia", {
    p_despesa_variavel_id: despesaVariavelId,
    p_ano: ano,
    p_mes: mes,
    p_pago: false,
  });
  if (error) return { ok: false, message: error.message };

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
  return { ok: true };
}

/** Manual-entry equivalent of the prototype's "Simular Envio" (see plan §9 comprovante note). */
export async function registrarComprovante(input: {
  descricao: string;
  banco: string;
  valor: number;
  servico_id?: string | null;
}): Promise<AcaoResultado> {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { error } = await supabase.from("comprovantes").insert({
    descricao: input.descricao,
    banco: input.banco,
    valor: input.valor,
    servico_id: input.servico_id ?? null,
    status: "pendente",
  });
  if (error) return { ok: false, message: error.message };
  revalidateFinanceiroPaths();
  revalidatePath("/hoje");
  return { ok: true };
}

export async function deleteComprovante(id: string): Promise<AcaoResultado> {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { data: comprovante } = await supabase
    .from("comprovantes")
    .select("status")
    .eq("id", id)
    .single();
  if (comprovante?.status !== "pendente") {
    return { ok: false, message: "Só é possível excluir comprovantes ainda pendentes." };
  }
  const { error } = await supabase.from("comprovantes").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateFinanceiroPaths();
  return { ok: true };
}

export async function confirmarComprovante(id: string): Promise<AcaoResultado> {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { data: comprovante, error: fetchErr } = await supabase
    .from("comprovantes")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchErr || !comprovante) return { ok: false, message: fetchErr?.message ?? "Comprovante não encontrado." };

  const { error: lancErr } = await supabase.from("lancamentos").insert({
    tipo: "Receita",
    descricao: `Comprovante - ${comprovante.banco}`,
    categoria: "Comprovante IA",
    valor: comprovante.valor,
    data: comprovante.data,
    servico_id: comprovante.servico_id,
  });
  if (lancErr) return { ok: false, message: lancErr.message };

  const { error: updErr } = await supabase
    .from("comprovantes")
    .update({ status: "confirmado" })
    .eq("id", id);
  if (updErr) return { ok: false, message: updErr.message };

  revalidateFinanceiroPaths();
  revalidatePath("/hoje");
  revalidatePath("/gestao");
  return { ok: true };
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
export async function lancarNovaDespesa(input: NovaDespesaRapidaInput): Promise<AcaoResultado> {
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
    if (error) return { ok: false, message: error.message };
    const resultado = await registrarPagamentoDespesaFixaOcorrencia(df.id, ano, mes, input.valor, input.data);
    if (!resultado.ok) return resultado;
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
    if (error) return { ok: false, message: error.message };
    const resultado = await registrarPagamentoDespesaVariavelOcorrencia(dv.id, ano, mes, input.valor, input.data);
    if (!resultado.ok) return resultado;
  }
  return { ok: true };
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
}): Promise<AcaoResultado> {
  await requireRole("administrador", "secretaria");
  const [anoStr, mesStr] = input.data.split("-");
  const ano = Number(anoStr);
  const mes = Number(mesStr);

  if (input.tipo === "fixa") {
    return registrarPagamentoDespesaFixaOcorrencia(input.despesaId, ano, mes, input.valor, input.data);
  }
  const resultadoValor = await updateDespesaVariavelValor(input.despesaId, ano, mes, input.valor);
  if (!resultadoValor.ok) return resultadoValor;
  return registrarPagamentoDespesaVariavelOcorrencia(input.despesaId, ano, mes, input.valor, input.data);
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
export async function lancarDespesaParcelada(input: DespesaParceladaInput): Promise<AcaoResultado> {
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
  if (error) return { ok: false, message: error.message };
  revalidateFinanceiroPaths();
  revalidatePath("/hoje");
  return { ok: true };
}

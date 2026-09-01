"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireHelysom } from "@/lib/domain/permissions";
import type { RecorrenciaPessoal, TipoMovimentoInvestimento } from "@/lib/domain/types";
import { gerarParcelasCompra, vencimentoDaFatura } from "@/lib/domain/financasPessoais";
import type { AcaoResultado, AcaoComSaldo } from "./resultado";

// NUNCA re-exportar tipos deste arquivo ("use server") com `export type { X }` — o scanner de
// exports do Next.js 16/Turbopack não reconhece esse padrão como type-only aqui: ele tenta
// registrar X como server action de verdade (`registerServerReference(X, ...)`), e como X só
// existe como tipo (apagado em runtime), TODA action deste módulo quebra com
// "ReferenceError: X is not defined" na avaliação do módulo — confirmado via log de produção
// (Vercel) depois que este arquivo cresceu o bastante pra disparar o bug. Quem precisar do tipo
// importa direto de "./resultado".

function revalidateFinancasPessoaisPaths() {
  revalidatePath("/financas-pessoais");
  revalidatePath("/financas-pessoais/visao-geral");
  revalidatePath("/financas-pessoais/receitas-despesas");
  revalidatePath("/financas-pessoais/contas");
  revalidatePath("/financas-pessoais/cartoes");
  revalidatePath("/financas-pessoais/dividas");
  revalidatePath("/financas-pessoais/investimentos");
}

// ── Contas ──────────────────────────────────────────────────────────────────────────────────

export interface ContaInput {
  nome: string;
  instituicao: string | null;
  tipo: string | null;
  saldo_inicial: number;
  data_saldo_inicial: string;
}

export async function createConta(input: ContaInput): Promise<AcaoResultado> {
  const profile = await requireHelysom();
  const supabase = await createClient();
  const { error } = await supabase.from("contas_pessoais").insert({ ...input, owner_id: profile.id });
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

export async function updateConta(id: string, input: ContaInput): Promise<AcaoResultado> {
  await requireHelysom();
  const supabase = await createClient();
  const { error } = await supabase.from("contas_pessoais").update(input).eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

/** Arquivar, nunca apagar — "arquivar uma conta não pode apagar seu histórico" (pedido
 * original). Uma conta arquivada some das opções de nova movimentação, mas o que já existe
 * (receitas/despesas/transferências vinculadas) continua intacto e consultável. */
export async function arquivarConta(id: string, ativa: boolean): Promise<AcaoResultado> {
  await requireHelysom();
  const supabase = await createClient();
  const { error } = await supabase.from("contas_pessoais").update({ ativa }).eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

// ── Origens de receita (catálogo editável) ─────────────────────────────────────────────────

export async function createOrigemReceita(nome: string): Promise<AcaoResultado> {
  const profile = await requireHelysom();
  const supabase = await createClient();
  const { error } = await supabase.from("origens_receita_pessoal").insert({ nome, owner_id: profile.id });
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

export async function renomearOrigemReceita(id: string, nome: string): Promise<AcaoResultado> {
  await requireHelysom();
  const supabase = await createClient();
  const { error } = await supabase.from("origens_receita_pessoal").update({ nome }).eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

export async function arquivarOrigemReceita(id: string, ativo: boolean): Promise<AcaoResultado> {
  await requireHelysom();
  const supabase = await createClient();
  const { error } = await supabase.from("origens_receita_pessoal").update({ ativo }).eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

// ── Receitas ────────────────────────────────────────────────────────────────────────────────

export interface ReceitaInput {
  descricao: string;
  origem_id: string | null;
  pagador: string | null;
  categoria: string | null;
  valor_previsto: number;
  conta_destino_id: string | null;
  data_prevista: string | null;
  recorrencia: RecorrenciaPessoal;
  observacoes: string | null;
}

export async function createReceita(input: ReceitaInput): Promise<AcaoResultado> {
  const profile = await requireHelysom();
  const supabase = await createClient();
  const { error } = await supabase.from("receitas_pessoais").insert({ ...input, owner_id: profile.id });
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

export async function updateReceita(id: string, input: ReceitaInput): Promise<AcaoResultado> {
  await requireHelysom();
  const supabase = await createClient();
  const { error } = await supabase.from("receitas_pessoais").update(input).eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

/** Cria a próxima ocorrência de uma receita recorrente a partir de uma já existente — sem
 * geração automática (o Helysom decide quando), copia descrição/origem/categoria/conta/valor
 * e desloca a data prevista um período pra frente. */
export async function duplicarReceitaProximoPeriodo(id: string): Promise<AcaoResultado> {
  const profile = await requireHelysom();
  const supabase = await createClient();
  const { data: origem, error: errOrigem } = await supabase.from("receitas_pessoais").select("*").eq("id", id).single();
  if (errOrigem || !origem) return { ok: false, message: errOrigem?.message ?? "Receita não encontrada." };

  const proximaData = deslocarData(origem.data_prevista, origem.recorrencia);
  const { error } = await supabase.from("receitas_pessoais").insert({
    owner_id: profile.id,
    descricao: origem.descricao,
    origem_id: origem.origem_id,
    pagador: origem.pagador,
    categoria: origem.categoria,
    valor_previsto: origem.valor_previsto,
    conta_destino_id: origem.conta_destino_id,
    data_prevista: proximaData,
    recorrencia: origem.recorrencia,
    observacoes: origem.observacoes,
  });
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

/** Bloqueia exclusão de receita já recebida no banco (trigger, migration 0039) — a mensagem do
 * Postgres já orienta cancelar em vez de excluir, só repassa. */
export async function deleteReceita(id: string): Promise<AcaoResultado> {
  await requireHelysom();
  const supabase = await createClient();
  const { error } = await supabase.from("receitas_pessoais").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

export async function cancelarReceita(id: string, motivo: string | null): Promise<AcaoResultado> {
  await requireHelysom();
  const supabase = await createClient();
  const { error } = await supabase
    .from("receitas_pessoais")
    .update({ situacao: "cancelada", cancelada_em: new Date().toISOString(), motivo_cancelamento: motivo })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

/** Registra um recebimento (total ou parcial) via RPC atômica `registrar_recebimento_pessoal`
 * (migration 0039) — bloqueia (não avisa) valor acima do saldo em aberto, mesmo padrão já
 * validado no lado empresarial (migration 0037). */
export async function registrarRecebimento(
  receitaId: string,
  fields: { valor: number; data: string; contaDestinoId: string | null }
): Promise<AcaoComSaldo> {
  await requireHelysom();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("registrar_recebimento_pessoal", {
    p_receita_id: receitaId,
    p_valor: fields.valor,
    p_data: fields.data,
    p_conta_destino_id: fields.contaDestinoId,
  });
  if (error) return { ok: false, message: error.message };
  const resultado = data as { ok: boolean; reason?: string; saldoRestante?: number };
  if (!resultado.ok) return { ok: false, message: resultado.reason ?? "Não foi possível registrar esse recebimento." };
  revalidateFinancasPessoaisPaths();
  return { ok: true, saldoRestante: resultado.saldoRestante ?? 0 };
}

export async function listarRecebimentosDaReceita(receitaId: string) {
  await requireHelysom();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recebimentos_pessoais")
    .select("*")
    .eq("receita_id", receitaId)
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function estornarRecebimento(recebimentoId: string, motivo: string | null): Promise<AcaoResultado> {
  await requireHelysom();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("estornar_recebimento_pessoal", {
    p_recebimento_id: recebimentoId,
    p_motivo: motivo,
  });
  if (error) return { ok: false, message: error.message };
  const resultado = data as { ok: boolean; reason?: string };
  if (!resultado.ok) return { ok: false, message: resultado.reason ?? "Não foi possível estornar esse recebimento." };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

// ── Despesas ────────────────────────────────────────────────────────────────────────────────

export interface DespesaInput {
  descricao: string;
  categoria: string | null;
  favorecido: string | null;
  valor_previsto: number;
  conta_id: string | null;
  vencimento: string | null;
  recorrencia: RecorrenciaPessoal;
  observacoes: string | null;
}

export async function createDespesa(input: DespesaInput): Promise<AcaoResultado> {
  const profile = await requireHelysom();
  const supabase = await createClient();
  const { error } = await supabase.from("despesas_pessoais").insert({ ...input, owner_id: profile.id });
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

export async function updateDespesa(id: string, input: DespesaInput): Promise<AcaoResultado> {
  await requireHelysom();
  const supabase = await createClient();
  const { error } = await supabase.from("despesas_pessoais").update(input).eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

export async function duplicarDespesaProximoPeriodo(id: string): Promise<AcaoResultado> {
  const profile = await requireHelysom();
  const supabase = await createClient();
  const { data: origem, error: errOrigem } = await supabase.from("despesas_pessoais").select("*").eq("id", id).single();
  if (errOrigem || !origem) return { ok: false, message: errOrigem?.message ?? "Despesa não encontrada." };

  const proximoVencimento = deslocarData(origem.vencimento, origem.recorrencia);
  const { error } = await supabase.from("despesas_pessoais").insert({
    owner_id: profile.id,
    descricao: origem.descricao,
    categoria: origem.categoria,
    favorecido: origem.favorecido,
    valor_previsto: origem.valor_previsto,
    conta_id: origem.conta_id,
    vencimento: proximoVencimento,
    recorrencia: origem.recorrencia,
    observacoes: origem.observacoes,
  });
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

export async function deleteDespesa(id: string): Promise<AcaoResultado> {
  await requireHelysom();
  const supabase = await createClient();
  const { error } = await supabase.from("despesas_pessoais").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

export async function cancelarDespesa(id: string, motivo: string | null): Promise<AcaoResultado> {
  await requireHelysom();
  const supabase = await createClient();
  const { error } = await supabase
    .from("despesas_pessoais")
    .update({ situacao: "cancelada", cancelada_em: new Date().toISOString(), motivo_cancelamento: motivo })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

export async function registrarPagamento(
  despesaId: string,
  fields: { valor: number; data: string; contaId: string | null }
): Promise<AcaoComSaldo> {
  await requireHelysom();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("registrar_pagamento_pessoal", {
    p_despesa_id: despesaId,
    p_valor: fields.valor,
    p_data: fields.data,
    p_conta_id: fields.contaId,
  });
  if (error) return { ok: false, message: error.message };
  const resultado = data as { ok: boolean; reason?: string; saldoRestante?: number };
  if (!resultado.ok) return { ok: false, message: resultado.reason ?? "Não foi possível registrar esse pagamento." };
  revalidateFinancasPessoaisPaths();
  return { ok: true, saldoRestante: resultado.saldoRestante ?? 0 };
}

export async function listarPagamentosDaDespesa(despesaId: string) {
  await requireHelysom();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pagamentos_pessoais")
    .select("*")
    .eq("despesa_id", despesaId)
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function estornarPagamento(pagamentoId: string, motivo: string | null): Promise<AcaoResultado> {
  await requireHelysom();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("estornar_pagamento_pessoal", {
    p_pagamento_id: pagamentoId,
    p_motivo: motivo,
  });
  if (error) return { ok: false, message: error.message };
  const resultado = data as { ok: boolean; reason?: string };
  if (!resultado.ok) return { ok: false, message: resultado.reason ?? "Não foi possível estornar esse pagamento." };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

// ── Transferências ──────────────────────────────────────────────────────────────────────────

export interface TransferenciaInput {
  conta_origem_id: string;
  conta_destino_id: string;
  valor: number;
  tarifa: number;
  data: string;
  descricao: string | null;
}

export async function createTransferencia(input: TransferenciaInput): Promise<AcaoResultado> {
  const profile = await requireHelysom();
  if (input.conta_origem_id === input.conta_destino_id) {
    return { ok: false, message: "A conta de origem e destino não podem ser a mesma." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("transferencias_pessoais").insert({ ...input, owner_id: profile.id });
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

// ── Cartões ─────────────────────────────────────────────────────────────────────────────────

export interface CartaoInput {
  nome: string;
  banco: string | null;
  dia_fechamento: number;
  dia_vencimento: number;
  limite: number | null;
}

export async function createCartao(input: CartaoInput): Promise<AcaoResultado> {
  const profile = await requireHelysom();
  const supabase = await createClient();
  const { error } = await supabase.from("cartoes_pessoais").insert({ ...input, owner_id: profile.id });
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

export async function updateCartao(id: string, input: CartaoInput): Promise<AcaoResultado> {
  await requireHelysom();
  const supabase = await createClient();
  const { error } = await supabase.from("cartoes_pessoais").update(input).eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

/** Desativar, nunca apagar — mesmo princípio de `arquivarConta`. */
export async function arquivarCartao(id: string, ativo: boolean): Promise<AcaoResultado> {
  await requireHelysom();
  const supabase = await createClient();
  const { error } = await supabase.from("cartoes_pessoais").update({ ativo }).eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

/** Bloqueado pelo banco (trigger, migration 0042) quando o cartão já tem compra registrada — a
 * mensagem do Postgres já orienta desativar em vez de excluir. */
export async function deleteCartao(id: string): Promise<AcaoResultado> {
  await requireHelysom();
  const supabase = await createClient();
  const { error } = await supabase.from("cartoes_pessoais").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

// ── Compras no cartão ───────────────────────────────────────────────────────────────────────

export interface CompraCartaoInput {
  cartaoId: string;
  descricao: string;
  categoria: string | null;
  valorTotal: number;
  parcelasTotal: number;
  dataCompra: string;
}

/** Grava uma linha por parcela (mesmo padrão de `servico_parcelas`) — a compra em si nunca é
 * uma despesa, só um compromisso; só a fatura consolidada (`lancarFaturaComoDespesa`) entra no
 * ledger de pagamento. */
export async function createCompraCartao(input: CompraCartaoInput): Promise<AcaoResultado> {
  const profile = await requireHelysom();
  if (input.parcelasTotal < 1) return { ok: false, message: "Número de parcelas precisa ser pelo menos 1." };
  const supabase = await createClient();
  const { data: cartao, error: errCartao } = await supabase
    .from("cartoes_pessoais")
    .select("dia_fechamento")
    .eq("id", input.cartaoId)
    .single();
  if (errCartao || !cartao) return { ok: false, message: errCartao?.message ?? "Cartão não encontrado." };

  const parcelas = gerarParcelasCompra(input.dataCompra, cartao.dia_fechamento, input.valorTotal, input.parcelasTotal);
  // Precisa gerar o grupo aqui e passar explícito em toda linha — sem isso, o default da coluna
  // (gen_random_uuid()) roda uma vez POR LINHA, e as parcelas da mesma compra nunca ficam
  // amarradas entre si (cancelar uma não cancela as outras, que é o objetivo do campo).
  const compraGrupoId = crypto.randomUUID();
  const rows = parcelas.map((p) => ({
    owner_id: profile.id,
    cartao_id: input.cartaoId,
    compra_grupo_id: compraGrupoId,
    descricao: input.descricao,
    categoria: input.categoria,
    valor_parcela: p.valor,
    numero_parcela: p.numero,
    parcelas_total: input.parcelasTotal,
    data_compra: input.dataCompra,
    fatura_ano: p.ano,
    fatura_mes: p.mes,
  }));
  const { error } = await supabase.from("compras_cartao_pessoal").insert(rows);
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

/** Cancela TODAS as parcelas da mesma compra (mesmo `compra_grupo_id`) — uma compra é cancelada
 * inteira (estorno/devolução), nunca uma parcela isolada. */
export async function cancelarCompraCartao(compraGrupoId: string, motivo: string | null): Promise<AcaoResultado> {
  const profile = await requireHelysom();
  const supabase = await createClient();
  const { error } = await supabase
    .from("compras_cartao_pessoal")
    .update({ cancelada_em: new Date().toISOString(), cancelada_por: profile.id, motivo_cancelamento: motivo })
    .eq("compra_grupo_id", compraGrupoId)
    .is("cancelada_em", null);
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

/** Só permite excluir de fato quando nenhuma parcela do grupo já está numa fatura lançada como
 * despesa — senão orienta cancelar em vez de excluir. */
export async function deleteCompraCartao(compraGrupoId: string): Promise<AcaoResultado> {
  await requireHelysom();
  const supabase = await createClient();
  const { data: parcelas, error: errParcelas } = await supabase
    .from("compras_cartao_pessoal")
    .select("cartao_id, fatura_ano, fatura_mes")
    .eq("compra_grupo_id", compraGrupoId);
  if (errParcelas) return { ok: false, message: errParcelas.message };
  if (!parcelas || parcelas.length === 0) return { ok: false, message: "Compra não encontrada." };

  for (const p of parcelas) {
    const { data: despesa } = await supabase
      .from("despesas_pessoais")
      .select("id")
      .eq("cartao_id", p.cartao_id)
      .eq("fatura_ano", p.fatura_ano)
      .eq("fatura_mes", p.fatura_mes)
      .maybeSingle();
    if (despesa) {
      return {
        ok: false,
        message: "Uma das parcelas dessa compra já está numa fatura lançada. Cancele a compra em vez de excluir.",
      };
    }
  }

  const { error } = await supabase.from("compras_cartao_pessoal").delete().eq("compra_grupo_id", compraGrupoId);
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

// ── Fatura do cartão — lançada como uma despesa normal (Bloco B), nunca uma segunda despesa ──

/** Soma as parcelas não canceladas do cartão nesse ano/mês e lança UMA despesa consolidada
 * (`cartao_id`/`fatura_ano`/`fatura_mes` preenchidos) — dali em diante é uma `despesas_pessoais`
 * comum, paga/estornada pelo ledger que já existe (`registrarPagamento`/`estornarPagamento`).
 * Recusa lançar de novo se essa fatura já foi lançada, e recusa lançar fatura vazia. */
export async function lancarFaturaComoDespesa(cartaoId: string, ano: number, mes: number): Promise<AcaoResultado> {
  const profile = await requireHelysom();
  const supabase = await createClient();

  const { data: jaExiste } = await supabase
    .from("despesas_pessoais")
    .select("id")
    .eq("cartao_id", cartaoId)
    .eq("fatura_ano", ano)
    .eq("fatura_mes", mes)
    .maybeSingle();
  if (jaExiste) return { ok: false, message: "Essa fatura já foi lançada como despesa." };

  const { data: cartao, error: errCartao } = await supabase
    .from("cartoes_pessoais")
    .select("nome, dia_fechamento, dia_vencimento")
    .eq("id", cartaoId)
    .single();
  if (errCartao || !cartao) return { ok: false, message: errCartao?.message ?? "Cartão não encontrado." };

  const { data: compras, error: errCompras } = await supabase
    .from("compras_cartao_pessoal")
    .select("valor_parcela")
    .eq("cartao_id", cartaoId)
    .eq("fatura_ano", ano)
    .eq("fatura_mes", mes)
    .is("cancelada_em", null);
  if (errCompras) return { ok: false, message: errCompras.message };
  const total = (compras ?? []).reduce((s, c) => s + Number(c.valor_parcela), 0);
  if (total <= 0) return { ok: false, message: "Não há compras nessa fatura pra lançar." };

  const vencimento = vencimentoDaFatura(ano, mes, cartao.dia_fechamento, cartao.dia_vencimento);
  const { error } = await supabase.from("despesas_pessoais").insert({
    owner_id: profile.id,
    descricao: `Fatura ${cartao.nome} — ${String(mes).padStart(2, "0")}/${ano}`,
    categoria: "Cartão de crédito",
    favorecido: cartao.nome,
    valor_previsto: total,
    vencimento,
    recorrencia: "unica",
    cartao_id: cartaoId,
    fatura_ano: ano,
    fatura_mes: mes,
  });
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

// ── Dívidas ─────────────────────────────────────────────────────────────────────────────────

export interface DividaInput {
  credor: string;
  descricao: string | null;
  saldo_inicial: number;
  valor_parcela: number | null;
  parcelas_restantes_inicial: number | null;
  dia_vencimento: number | null;
  taxa_juros_mensal: number | null;
  observacoes: string | null;
}

export async function createDivida(input: DividaInput): Promise<AcaoResultado> {
  const profile = await requireHelysom();
  const supabase = await createClient();
  const { error } = await supabase.from("dividas_pessoais").insert({ ...input, owner_id: profile.id });
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

export async function updateDivida(id: string, input: DividaInput): Promise<AcaoResultado> {
  await requireHelysom();
  const supabase = await createClient();
  const { error } = await supabase.from("dividas_pessoais").update(input).eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

/** Bloqueado pelo banco (trigger) quando a dívida já tem pagamento registrado. */
export async function deleteDivida(id: string): Promise<AcaoResultado> {
  await requireHelysom();
  const supabase = await createClient();
  const { error } = await supabase.from("dividas_pessoais").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

export async function registrarPagamentoDivida(
  dividaId: string,
  fields: { valor: number; data: string; contaId: string | null }
): Promise<AcaoComSaldo> {
  await requireHelysom();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("registrar_pagamento_divida_pessoal", {
    p_divida_id: dividaId,
    p_valor: fields.valor,
    p_data: fields.data,
    p_conta_id: fields.contaId,
  });
  if (error) return { ok: false, message: error.message };
  const resultado = data as { ok: boolean; reason?: string; saldoRestante?: number };
  if (!resultado.ok) return { ok: false, message: resultado.reason ?? "Não foi possível registrar esse pagamento." };
  revalidateFinancasPessoaisPaths();
  return { ok: true, saldoRestante: resultado.saldoRestante ?? 0 };
}

export async function listarPagamentosDaDivida(dividaId: string) {
  await requireHelysom();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pagamentos_divida_pessoal")
    .select("*")
    .eq("divida_id", dividaId)
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function estornarPagamentoDivida(pagamentoId: string, motivo: string | null): Promise<AcaoResultado> {
  await requireHelysom();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("estornar_pagamento_divida_pessoal", {
    p_pagamento_id: pagamentoId,
    p_motivo: motivo,
  });
  if (error) return { ok: false, message: error.message };
  const resultado = data as { ok: boolean; reason?: string };
  if (!resultado.ok) return { ok: false, message: resultado.reason ?? "Não foi possível estornar esse pagamento." };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

// ── Investimentos ───────────────────────────────────────────────────────────────────────────

export interface InvestimentoInput {
  nome: string;
  tipo: string | null;
  instituicao: string | null;
}

export async function createInvestimento(input: InvestimentoInput): Promise<AcaoResultado> {
  const profile = await requireHelysom();
  const supabase = await createClient();
  const { error } = await supabase.from("investimentos_pessoais").insert({ ...input, owner_id: profile.id });
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

export async function updateInvestimento(id: string, input: InvestimentoInput): Promise<AcaoResultado> {
  await requireHelysom();
  const supabase = await createClient();
  const { error } = await supabase.from("investimentos_pessoais").update(input).eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

/** Desativar, nunca apagar — mesmo princípio de `arquivarConta`/`arquivarCartao`. */
export async function arquivarInvestimento(id: string, ativo: boolean): Promise<AcaoResultado> {
  await requireHelysom();
  const supabase = await createClient();
  const { error } = await supabase.from("investimentos_pessoais").update({ ativo }).eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

/** Bloqueado pelo banco (trigger) quando o investimento já tem movimentação registrada. */
export async function deleteInvestimento(id: string): Promise<AcaoResultado> {
  await requireHelysom();
  const supabase = await createClient();
  const { error } = await supabase.from("investimentos_pessoais").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

/** Registra aporte, resgate ou rendimento via RPC atômica — bloqueia (não avisa) resgate acima
 * do saldo investido, mesmo padrão já validado nos outros blocos. */
export async function registrarMovimentoInvestimento(
  investimentoId: string,
  tipo: TipoMovimentoInvestimento,
  fields: { valor: number; data: string; contaId: string | null }
): Promise<AcaoResultado> {
  await requireHelysom();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("registrar_movimento_investimento_pessoal", {
    p_investimento_id: investimentoId,
    p_tipo: tipo,
    p_valor: fields.valor,
    p_data: fields.data,
    p_conta_id: fields.contaId,
  });
  if (error) return { ok: false, message: error.message };
  const resultado = data as { ok: boolean; reason?: string };
  if (!resultado.ok) return { ok: false, message: resultado.reason ?? "Não foi possível registrar esse movimento." };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

export async function listarMovimentosDoInvestimento(investimentoId: string) {
  await requireHelysom();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("movimentos_investimento_pessoal")
    .select("*")
    .eq("investimento_id", investimentoId)
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function estornarMovimentoInvestimento(movimentoId: string, motivo: string | null): Promise<AcaoResultado> {
  await requireHelysom();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("estornar_movimento_investimento_pessoal", {
    p_movimento_id: movimentoId,
    p_motivo: motivo,
  });
  if (error) return { ok: false, message: error.message };
  const resultado = data as { ok: boolean; reason?: string };
  if (!resultado.ok) return { ok: false, message: resultado.reason ?? "Não foi possível estornar esse movimento." };
  revalidateFinancasPessoaisPaths();
  return { ok: true };
}

// ── Auxiliar ────────────────────────────────────────────────────────────────────────────────

function deslocarData(data: string | null, recorrencia: RecorrenciaPessoal): string | null {
  if (!data) return null;
  const d = new Date(data + "T00:00:00");
  if (recorrencia === "semanal") d.setDate(d.getDate() + 7);
  else if (recorrencia === "anual") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1); // 'mensal' e 'unica' (duplicar única também avança 1 mês por padrão)
  return d.toISOString().slice(0, 10);
}

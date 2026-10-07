"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/domain/permissions";
import { classificarMovimentos, deslocarISO, type FilaClassificada, type MovimentoSincronizado } from "@/lib/domain/filaConfirmacao";
import type { RegraLancamento } from "@/lib/domain/regras";
import type { Lancamento, UnidadeNegocio } from "@/lib/domain/types";
import { revalidateFinanceiroPaths } from "./revalidateFinanceiro";
import type { AcaoResultado } from "./resultado";

const COLUNAS_MOVIMENTO = "id, data, descricao, contraparte, valor, tipo, conciliado, ignorado_em";

function revalidarTudo() {
  revalidateFinanceiroPaths();
  revalidatePath("/hoje");
  revalidatePath("/gestao");
}

/** Movimentos sincronizados que ainda esperam confirmação, já classificados (novo / dar baixa).
 * Só leitura — nada é lançado aqui. */
export async function filaDeConfirmacao(meuNome = ""): Promise<FilaClassificada> {
  await requireRole("administrador");
  const supabase = await createClient();

  const { data: movimentosRaw, error } = await supabase
    .from("mercadopago_movimentos")
    .select(COLUNAS_MOVIMENTO)
    .eq("conciliado", false)
    .is("ignorado_em", null)
    .order("data", { ascending: false })
    .limit(200);
  if (error) throw error;
  const movimentos = (movimentosRaw as MovimentoSincronizado[]) ?? [];
  if (movimentos.length === 0) return { itens: [], jaLancados: 0 };

  const datas = movimentos.map((m) => m.data).sort();
  const inicio = deslocarISO(datas[0], -10);
  const fim = deslocarISO(datas[datas.length - 1], 10);

  const [{ data: lancamentos }, { data: regras }] = await Promise.all([
    supabase.from("lancamentos").select("*").gte("data", inicio).lte("data", fim),
    supabase.from("regras_lancamento").select("*").eq("ativo", true),
  ]);

  return classificarMovimentos(
    movimentos,
    (lancamentos as Lancamento[]) ?? [],
    (regras as RegraLancamento[]) ?? [],
    meuNome
  );
}

async function carregarMovimentoPendente(movimentoId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("mercadopago_movimentos")
    .select(COLUNAS_MOVIMENTO)
    .eq("id", movimentoId)
    .maybeSingle();
  const movimento = data as MovimentoSincronizado | null;
  if (!movimento) return { supabase, movimento: null, motivo: "Esse movimento não existe mais." };
  if (movimento.conciliado || movimento.ignorado_em) {
    return { supabase, movimento: null, motivo: "Esse movimento já foi tratado." };
  }
  return { supabase, movimento, motivo: "" };
}

export interface AprovarMovimentoInput {
  movimentoId: string;
  categoria: string;
  unidade: UnidadeNegocio | null;
  /** Se vier preenchido, grava uma regra: dali em diante esse nome já vem sugerido. */
  lembrarComo: string | null;
}

/** Cria o lançamento a partir do movimento (com a data REAL do banco) e marca o movimento
 * como conciliado. Só roda por clique de um Administrador na fila. */
export async function aprovarMovimento(input: AprovarMovimentoInput): Promise<AcaoResultado> {
  const profile = await requireRole("administrador");
  const { supabase, movimento, motivo } = await carregarMovimentoPendente(input.movimentoId);
  if (!movimento) return { ok: false, message: motivo };

  const { data: criado, error } = await supabase
    .from("lancamentos")
    .insert({
      tipo: movimento.tipo,
      descricao: movimento.descricao,
      categoria: input.categoria.trim() || "Geral",
      valor: movimento.valor,
      data: movimento.data,
      banco: "Mercado Pago",
      status: "realizado",
      ...(input.unidade ? { unidade_negocio: input.unidade } : {}),
    })
    .select("id")
    .single();
  if (error || !criado) return { ok: false, message: error?.message ?? "Não foi possível criar o lançamento." };

  const { error: erroMovimento } = await supabase
    .from("mercadopago_movimentos")
    .update({ conciliado: true, lancamento_id: criado.id })
    .eq("id", movimento.id);
  if (erroMovimento) return { ok: false, message: erroMovimento.message };

  const padrao = input.lembrarComo?.trim();
  if (padrao && padrao.length >= 4) {
    await supabase.from("regras_lancamento").insert({
      padrao,
      tipo: movimento.tipo,
      categoria: input.categoria.trim() || null,
      unidade_negocio: input.unidade,
      recorrencia: "nenhuma",
      criado_por: profile.id,
    });
  }

  revalidarTudo();
  return { ok: true };
}

/** Em vez de criar um lançamento novo, dá baixa no previsto (ex: boleto já lançado): marca
 * realizado e acerta a data pra do banco, sem duplicar. */
export async function baixarPrevisto(movimentoId: string, lancamentoId: string): Promise<AcaoResultado> {
  await requireRole("administrador");
  const { supabase, movimento, motivo } = await carregarMovimentoPendente(movimentoId);
  if (!movimento) return { ok: false, message: motivo };

  const { data: alvo } = await supabase.from("lancamentos").select("*").eq("id", lancamentoId).maybeSingle();
  const lancamento = alvo as Lancamento | null;
  if (!lancamento) return { ok: false, message: "Esse lançamento não existe mais." };
  if (lancamento.status !== "previsto") return { ok: false, message: "Esse lançamento já não está previsto." };
  if (lancamento.tipo !== movimento.tipo || Math.abs(lancamento.valor - movimento.valor) >= 0.01) {
    return { ok: false, message: "O valor ou o tipo desse lançamento não bate com o movimento do banco." };
  }

  const { error } = await supabase
    .from("lancamentos")
    .update({ status: "realizado", data: movimento.data, banco: lancamento.banco ?? "Mercado Pago" })
    .eq("id", lancamento.id);
  if (error) return { ok: false, message: error.message };

  const { error: erroMovimento } = await supabase
    .from("mercadopago_movimentos")
    .update({ conciliado: true, lancamento_id: lancamento.id })
    .eq("id", movimento.id);
  if (erroMovimento) return { ok: false, message: erroMovimento.message };

  revalidarTudo();
  return { ok: true };
}

export async function ignorarMovimento(movimentoId: string): Promise<AcaoResultado> {
  await requireRole("administrador");
  const supabase = await createClient();
  const { error } = await supabase
    .from("mercadopago_movimentos")
    .update({ ignorado_em: new Date().toISOString() })
    .eq("id", movimentoId)
    .eq("conciliado", false);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/hoje");
  return { ok: true };
}

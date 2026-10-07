"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { fetchAllClientes } from "@/lib/supabase/fetchAllClientes";
import { requireRole } from "@/lib/domain/permissions";
import {
  classificarMovimentos,
  deslocarISO,
  type FilaClassificada,
  type MovimentoSincronizado,
  type ServicoParaCruzamento,
} from "@/lib/domain/filaConfirmacao";
import type { RegraLancamento } from "@/lib/domain/regras";
import type { Cliente, Lancamento, ServicoParcela, UnidadeNegocio } from "@/lib/domain/types";
import { marcarParcelaPaga } from "./parcelas";
import { revalidateFinanceiroPaths } from "./revalidateFinanceiro";
import type { AcaoResultado } from "./resultado";

// "*" (e não uma lista de colunas): assim a fila continua funcionando mesmo antes de a coluna
// `pagador` existir no banco.
const COLUNAS_MOVIMENTO = "*";

const TAMANHO_PAGINA = 1000;

/** O Supabase corta cada consulta em 1000 linhas; parcelas e OS já passam disso. */
async function buscarTodas<T>(
  consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const todas: T[] = [];
  for (let de = 0; ; de += TAMANHO_PAGINA) {
    const { data, error } = await consulta(de, de + TAMANHO_PAGINA - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    todas.push(...data);
    if (data.length < TAMANHO_PAGINA) break;
  }
  return todas;
}

async function parcelasEServicos(supabase: SupabaseClient) {
  const [parcelas, servicos, clientes] = await Promise.all([
    buscarTodas<ServicoParcela>((de, ate) =>
      supabase.from("servico_parcelas").select("*").is("cancelada_em", null).order("id").range(de, ate)
    ),
    buscarTodas<ServicoParaCruzamento>((de, ate) =>
      supabase.from("servicos").select("id, numero, cliente, cliente_id, financeiro_status").order("id").range(de, ate)
    ),
    fetchAllClientes(supabase),
  ]);
  return {
    parcelas,
    servicos,
    clientes: (clientes as Cliente[]).map((c) => ({ id: c.id, nome: c.nome, empresa: c.empresa, cpf_cnpj: c.cpf_cnpj })),
  };
}

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

  const temEntrada = movimentos.some((m) => m.tipo === "Receita");
  const [{ data: lancamentos }, { data: regras }, recebiveis] = await Promise.all([
    supabase.from("lancamentos").select("*").gte("data", inicio).lte("data", fim),
    supabase.from("regras_lancamento").select("*").eq("ativo", true),
    // Só vale buscar parcelas/OS/clientes se há entrada pra cruzar com "a receber".
    temEntrada ? parcelasEServicos(supabase) : Promise.resolve({ parcelas: [], servicos: [], clientes: [] }),
  ]);

  return classificarMovimentos(
    movimentos,
    (lancamentos as Lancamento[]) ?? [],
    (regras as RegraLancamento[]) ?? [],
    meuNome,
    recebiveis
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

/**
 * "Sim, esse Pix é o pagamento dessa parcela": registra o recebimento pela ação oficial
 * (`marcarParcelaPaga` → RPC atômica, que bloqueia valor maior que o saldo e atualiza a OS),
 * com o valor e a DATA REAIS do banco, e marca o movimento como conciliado. Só roda por clique
 * de um Administrador na fila.
 */
export async function receberParcelaComMovimento(movimentoId: string, parcelaId: string): Promise<AcaoResultado> {
  await requireRole("administrador");
  const { supabase, movimento, motivo } = await carregarMovimentoPendente(movimentoId);
  if (!movimento) return { ok: false, message: motivo };
  if (movimento.tipo !== "Receita") return { ok: false, message: "Só uma entrada pode pagar uma parcela." };

  const { data: parcela } = await supabase
    .from("servico_parcelas")
    .select("id, servico_id, valor_previsto, valor_pago, cancelada_em")
    .eq("id", parcelaId)
    .maybeSingle();
  if (!parcela || parcela.cancelada_em) return { ok: false, message: "Essa parcela não existe mais ou foi cancelada." };
  const saldo = parcela.valor_previsto - (parcela.valor_pago ?? 0);
  if (movimento.valor > saldo + 0.01) {
    return { ok: false, message: "O Pix é maior que o saldo em aberto dessa parcela." };
  }

  const recebido = await marcarParcelaPaga(parcela.id, parcela.servico_id, {
    valorRecebidoAgora: movimento.valor,
    dataPagamento: movimento.data,
    formaPagamento: "Pix",
  });
  if (!recebido.ok) return { ok: false, message: recebido.message };

  const { error } = await supabase.from("mercadopago_movimentos").update({ conciliado: true }).eq("id", movimento.id);
  if (error) return { ok: false, message: error.message };

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

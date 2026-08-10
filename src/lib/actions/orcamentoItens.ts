"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { CategoriaPrazo, ModoCalculoItem } from "@/lib/domain/orcamento";

export interface OrcamentoItemInput {
  ordem: number;
  descricao: string;
  categoriaPrazo: CategoriaPrazo;
  modoCalculo: ModoCalculoItem;
  itemOrcamentoId: string | null;
  larguraCm: number | null;
  alturaCm: number | null;
  quantidade: number;
  custoDireto: number | null;
  precoM2Manual: number | null;
  valorFinal: number;
}

export async function createOrcamentoItens(servicoId: string, itens: OrcamentoItemInput[]) {
  if (itens.length === 0) return;
  const supabase = await createClient();
  const { error } = await supabase.from("orcamento_itens").insert(
    itens.map((item) => ({
      servico_id: servicoId,
      ordem: item.ordem,
      descricao: item.descricao,
      categoria_prazo: item.categoriaPrazo,
      modo_calculo: item.modoCalculo,
      item_orcamento_id: item.itemOrcamentoId,
      largura_cm: item.larguraCm,
      altura_cm: item.alturaCm,
      quantidade: item.quantidade,
      custo_direto: item.custoDireto,
      preco_m2_manual: item.precoM2Manual,
      valor_final: item.valorFinal,
    }))
  );
  if (error) throw error;
}

/**
 * Substitui todos os itens do orçamento por um novo conjunto (edição pós-criação) e
 * recalcula servicos.valor a partir da soma — igual ao que já acontece na criação.
 * Também sobe financeiro_status de "Não orçado" pra "Orçado" quando passa a ter valor,
 * sem mexer num status mais avançado (Pago, Cortesia etc.) que já estava definido.
 */
export async function replaceOrcamentoItens(servicoId: string, itens: OrcamentoItemInput[]) {
  const supabase = await createClient();
  const total = itens.reduce((sum, item) => sum + item.valorFinal, 0);

  const { error: delErr } = await supabase.from("orcamento_itens").delete().eq("servico_id", servicoId);
  if (delErr) throw delErr;

  if (itens.length > 0) {
    const { error: insErr } = await supabase.from("orcamento_itens").insert(
      itens.map((item) => ({
        servico_id: servicoId,
        ordem: item.ordem,
        descricao: item.descricao,
        categoria_prazo: item.categoriaPrazo,
        modo_calculo: item.modoCalculo,
        item_orcamento_id: item.itemOrcamentoId,
        largura_cm: item.larguraCm,
        altura_cm: item.alturaCm,
        quantidade: item.quantidade,
        custo_direto: item.custoDireto,
        preco_m2_manual: item.precoM2Manual,
        valor_final: item.valorFinal,
      }))
    );
    if (insErr) throw insErr;
  }

  const { data: sv, error: fetchErr } = await supabase
    .from("servicos")
    .select("financeiro_status")
    .eq("id", servicoId)
    .single();
  if (fetchErr) throw fetchErr;

  const fields: { valor: number; financeiro_status?: string } = { valor: total };
  if (sv.financeiro_status === "Não orçado" && total > 0) {
    fields.financeiro_status = "Orçado";
  }

  const { error: updErr } = await supabase.from("servicos").update(fields).eq("id", servicoId);
  if (updErr) throw updErr;

  revalidatePath("/producao/servicos");
  revalidatePath("/hoje");
}

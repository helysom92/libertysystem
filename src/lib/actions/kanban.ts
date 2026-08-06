"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { KanbanBoardKey } from "@/lib/domain/kanban";

export interface MoveResult {
  ok: boolean;
  reason?: string;
  numero?: string;
}

export async function createColuna(board: KanbanBoardKey, label: string) {
  const supabase = await createClient();
  const { data: existentes } = await supabase
    .from("colunas")
    .select("ordem")
    .eq("board", board)
    .order("ordem", { ascending: false })
    .limit(1);
  const proximaOrdem = (existentes?.[0]?.ordem ?? -1) + 1;
  const { error } = await supabase.from("colunas").insert({ board, label, ordem: proximaOrdem });
  if (error) throw error;
  revalidatePath("/producao/servicos");
}

export async function renameColuna(id: string, label: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("colunas").update({ label }).eq("id", id);
  if (error) throw error;
  revalidatePath("/producao/servicos");
}

export async function toggleConclusaoColuna(id: string, value: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("colunas").update({ is_conclusao: value }).eq("id", id);
  if (error) throw error;
  revalidatePath("/producao/servicos");
}

export async function deleteColuna(id: string): Promise<MoveResult> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("servicos")
    .select("id", { count: "exact", head: true })
    .eq("coluna_id", id);
  if (count && count > 0) {
    return { ok: false, reason: `Essa coluna ainda tem ${count} card(s) — mova ou apague eles antes.` };
  }
  const { error } = await supabase.from("colunas").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/producao/servicos");
  return { ok: true };
}

export async function moveCardParaColuna(servicoId: string, colunaId: string): Promise<MoveResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("move_card_para_coluna", {
    p_servico_id: servicoId,
    p_coluna_id: colunaId,
  });
  if (error) throw error;
  revalidatePath("/producao/servicos");
  revalidatePath("/hoje");
  revalidatePath("/gestao");
  return data as MoveResult;
}

export async function aprovarOrcamento(servicoId: string): Promise<MoveResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("aprova_orcamento", { p_servico_id: servicoId });
  if (error) throw error;
  revalidatePath("/producao/servicos");
  revalidatePath("/hoje");
  return data as MoveResult;
}

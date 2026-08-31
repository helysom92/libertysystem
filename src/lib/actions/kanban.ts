"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { revalidateServicoPaths } from "./revalidateServicos";
import type { KanbanBoardKey } from "@/lib/domain/kanban";
import { requireRole } from "@/lib/domain/permissions";
import type { AcaoResultado } from "./resultado";

export interface MoveResult {
  ok: boolean;
  message?: string;
  numero?: string;
}

/**
 * A coluna de conclusão (is_conclusao) tem que continuar sendo sempre a última — então uma
 * coluna nova entra no lugar que era o fim da lista, e a de conclusão é empurrada pra depois
 * dela, em vez de simplesmente colar tudo no fim.
 */
export async function createColuna(board: KanbanBoardKey, label: string): Promise<AcaoResultado> {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { data: existentes } = await supabase
    .from("colunas")
    .select("id, ordem, is_conclusao")
    .eq("board", board)
    .order("ordem", { ascending: true });

  const lista = existentes ?? [];
  const maxOrdem = lista.length > 0 ? Math.max(...lista.map((c) => c.ordem)) : -1;
  const conclusao = lista.find((c) => c.is_conclusao);

  if (conclusao) {
    const { error: insErr } = await supabase.from("colunas").insert({ board, label, ordem: conclusao.ordem });
    if (insErr) return { ok: false, message: insErr.message };
    const { error: updErr } = await supabase
      .from("colunas")
      .update({ ordem: maxOrdem + 1 })
      .eq("id", conclusao.id);
    if (updErr) return { ok: false, message: updErr.message };
  } else {
    const { error } = await supabase.from("colunas").insert({ board, label, ordem: maxOrdem + 1 });
    if (error) return { ok: false, message: error.message };
  }
  revalidateServicoPaths();
  return { ok: true };
}

export async function renameColuna(id: string, label: string): Promise<AcaoResultado> {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { error } = await supabase.from("colunas").update({ label }).eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateServicoPaths();
  return { ok: true };
}

export async function toggleConclusaoColuna(id: string, value: boolean): Promise<AcaoResultado> {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { error } = await supabase.from("colunas").update({ is_conclusao: value }).eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateServicoPaths();
  return { ok: true };
}

export async function deleteColuna(id: string): Promise<MoveResult> {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { count } = await supabase
    .from("servicos")
    .select("id", { count: "exact", head: true })
    .eq("coluna_id", id);
  if (count && count > 0) {
    return { ok: false, message: `Essa coluna ainda tem ${count} card(s) — mova ou apague eles antes.` };
  }
  const { error } = await supabase.from("colunas").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateServicoPaths();
  return { ok: true };
}

export async function moveCardParaColuna(servicoId: string, colunaId: string): Promise<MoveResult> {
  await requireRole("administrador", "secretaria", "producao");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("move_card_para_coluna", {
    p_servico_id: servicoId,
    p_coluna_id: colunaId,
  });
  if (error) return { ok: false, message: error.message };
  revalidateServicoPaths();
  revalidatePath("/hoje");
  revalidatePath("/gestao");
  const r = data as { ok: boolean; reason?: string };
  return { ok: r.ok, message: r.reason };
}

export async function aprovarOrcamento(servicoId: string): Promise<MoveResult> {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("aprova_orcamento", { p_servico_id: servicoId });
  if (error) return { ok: false, message: error.message };
  revalidateServicoPaths();
  revalidatePath("/hoje");
  const r = data as { ok: boolean; reason?: string; numero?: string };
  return { ok: r.ok, message: r.reason, numero: r.numero };
}

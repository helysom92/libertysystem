"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidateServicoPaths } from "./revalidateServicos";
import { requireRole } from "@/lib/domain/permissions";

export interface NovaMedidaInput {
  largura: number;
  altura: number;
  profundidade: number;
  unidade: "m" | "cm" | "mm";
  quantidade: number;
  local_medicao: string;
  responsavel: string;
  observacoes: string;
}

export async function addMedida(servicoId: string, input: NovaMedidaInput) {
  await requireRole("administrador", "secretaria", "producao");
  const supabase = await createClient();
  const { error } = await supabase.from("medicoes").insert({ servico_id: servicoId, ...input });
  if (error) throw error;
  revalidateServicoPaths();
}

export async function addArquivo(servicoId: string, nome: string, storagePath: string, sizeBytes: number, contentType: string) {
  await requireRole("administrador", "secretaria", "producao");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("arquivos").insert({
    servico_id: servicoId,
    nome,
    storage_path: storagePath,
    tamanho_bytes: sizeBytes,
    content_type: contentType,
    uploaded_by: user?.id ?? null,
  });
  if (error) throw error;
  revalidateServicoPaths();
}

export async function removeArquivo(id: string, storagePath: string) {
  await requireRole("administrador", "secretaria", "producao");
  const supabase = await createClient();
  await supabase.storage.from("arquivos").remove([storagePath]);
  const { error } = await supabase.from("arquivos").delete().eq("id", id);
  if (error) throw error;
  revalidateServicoPaths();
}

export async function upsertFoto(servicoId: string, slot: number, storagePath: string) {
  await requireRole("administrador", "secretaria", "producao");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fotos")
    .upsert({ servico_id: servicoId, slot, storage_path: storagePath }, { onConflict: "servico_id,slot" })
    .select("id")
    .single();
  if (error) throw error;
  revalidateServicoPaths();
  return data.id as string;
}

export async function setCapaFoto(servicoId: string, fotoId: string) {
  await requireRole("administrador", "secretaria", "producao");
  const supabase = await createClient();
  const { error } = await supabase.from("servicos").update({ capa_foto_id: fotoId }).eq("id", servicoId);
  if (error) throw error;
  revalidateServicoPaths();
}

/** Cria um espaço de foto vazio (sem limite fixo) — próximo slot livre pra esse serviço. */
export async function addFotoSlot(servicoId: string): Promise<number> {
  await requireRole("administrador", "secretaria", "producao");
  const supabase = await createClient();
  const { data: existentes } = await supabase
    .from("fotos")
    .select("slot")
    .eq("servico_id", servicoId)
    .order("slot", { ascending: false })
    .limit(1);
  const proximoSlot = (existentes?.[0]?.slot ?? 0) + 1;
  const { error } = await supabase.from("fotos").insert({ servico_id: servicoId, slot: proximoSlot });
  if (error) throw error;
  revalidateServicoPaths();
  return proximoSlot;
}

export async function removeFoto(fotoId: string, storagePath: string | null) {
  await requireRole("administrador", "secretaria", "producao");
  const supabase = await createClient();
  if (storagePath) {
    await supabase.storage.from("fotos").remove([storagePath]);
  }
  // capa_foto_id tem "on delete set null" — se essa era a capa, a referência já limpa sozinha.
  const { error } = await supabase.from("fotos").delete().eq("id", fotoId);
  if (error) throw error;
  revalidateServicoPaths();
}

export async function addChecklistItem(servicoId: string, texto: string) {
  await requireRole("administrador", "secretaria", "producao");
  const supabase = await createClient();
  const { error } = await supabase.from("checklist_items").insert({ servico_id: servicoId, texto });
  if (error) throw error;
  revalidateServicoPaths();
}

export async function toggleChecklistItem(id: string, done: boolean) {
  await requireRole("administrador", "secretaria", "producao");
  const supabase = await createClient();
  const { error } = await supabase.from("checklist_items").update({ done }).eq("id", id);
  if (error) throw error;
  revalidateServicoPaths();
}

export async function removeChecklistItem(id: string) {
  await requireRole("administrador", "secretaria", "producao");
  const supabase = await createClient();
  const { error } = await supabase.from("checklist_items").delete().eq("id", id);
  if (error) throw error;
  revalidateServicoPaths();
}

export async function getSignedUrl(bucket: "arquivos" | "fotos", path: string) {
  await requireRole("administrador", "secretaria", "producao");
  const supabase = await createClient();
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

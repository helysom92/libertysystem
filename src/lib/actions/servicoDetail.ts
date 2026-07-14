"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
  const supabase = await createClient();
  const { error } = await supabase.from("medicoes").insert({ servico_id: servicoId, ...input });
  if (error) throw error;
  revalidatePath("/servicos");
}

export async function addArquivo(servicoId: string, nome: string, storagePath: string, sizeBytes: number, contentType: string) {
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
  revalidatePath("/servicos");
}

export async function removeArquivo(id: string, storagePath: string) {
  const supabase = await createClient();
  await supabase.storage.from("arquivos").remove([storagePath]);
  const { error } = await supabase.from("arquivos").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/servicos");
}

export async function upsertFoto(servicoId: string, slot: number, storagePath: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fotos")
    .upsert({ servico_id: servicoId, slot, storage_path: storagePath }, { onConflict: "servico_id,slot" })
    .select("id")
    .single();
  if (error) throw error;
  revalidatePath("/servicos");
  return data.id as string;
}

export async function setCapaFoto(servicoId: string, fotoId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("servicos").update({ capa_foto_id: fotoId }).eq("id", servicoId);
  if (error) throw error;
  revalidatePath("/servicos");
}

export async function addChecklistItem(servicoId: string, texto: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("checklist_items").insert({ servico_id: servicoId, texto });
  if (error) throw error;
  revalidatePath("/servicos");
}

export async function toggleChecklistItem(id: string, done: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("checklist_items").update({ done }).eq("id", id);
  if (error) throw error;
  revalidatePath("/servicos");
}

export async function removeChecklistItem(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("checklist_items").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/servicos");
}

export async function getSignedUrl(bucket: "arquivos" | "fotos", path: string) {
  const supabase = await createClient();
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

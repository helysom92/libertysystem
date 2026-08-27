"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { revalidateServicoPaths } from "./revalidateServicos";
import { requireRole } from "@/lib/domain/permissions";

export interface NovoEventoInput {
  data: string;
  hora: string;
  tipo: string;
  servico_id: string | null;
  cliente: string;
  endereco: string;
  responsavel: string;
  whatsapp: string;
}

export async function createEvento(input: NovoEventoInput) {
  await requireRole("administrador", "secretaria", "producao");
  const supabase = await createClient();
  const { error } = await supabase.from("eventos").insert(input);
  if (error) throw error;
  revalidatePath("/producao/agenda");
  revalidateServicoPaths();
}

export async function deleteEvento(id: string) {
  await requireRole("administrador", "secretaria", "producao");
  const supabase = await createClient();
  const { error } = await supabase.from("eventos").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/producao/agenda");
  revalidateServicoPaths();
}

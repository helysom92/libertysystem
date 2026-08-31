"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { revalidateServicoPaths } from "./revalidateServicos";
import { requireRole } from "@/lib/domain/permissions";
import type { AcaoResultado } from "./resultado";

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

export async function createEvento(input: NovoEventoInput): Promise<AcaoResultado> {
  await requireRole("administrador", "secretaria", "producao");
  const supabase = await createClient();
  const { error } = await supabase.from("eventos").insert(input);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/producao/agenda");
  revalidateServicoPaths();
  return { ok: true };
}

export async function deleteEvento(id: string): Promise<AcaoResultado> {
  await requireRole("administrador", "secretaria", "producao");
  const supabase = await createClient();
  const { error } = await supabase.from("eventos").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/producao/agenda");
  revalidateServicoPaths();
  return { ok: true };
}

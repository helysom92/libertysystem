"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
  const supabase = await createClient();
  const { error } = await supabase.from("eventos").insert(input);
  if (error) throw error;
  revalidatePath("/agenda");
}

export async function deleteEvento(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("eventos").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/agenda");
}

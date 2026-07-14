"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface NovoMaterialInput {
  nome: string;
  unidade: "m2" | "metro_linear" | "unidade";
  preco_unitario: number;
  categoria?: string | null;
}

export async function createMaterial(input: NovoMaterialInput) {
  const supabase = await createClient();
  const { error } = await supabase.from("materiais").insert(input);
  if (error) throw error;
  revalidatePath("/materiais");
}

export async function updateMaterial(
  id: string,
  fields: Partial<{
    nome: string;
    unidade: "m2" | "metro_linear" | "unidade";
    preco_unitario: number;
    categoria: string | null;
    ativo: boolean;
  }>
) {
  const supabase = await createClient();
  const { error } = await supabase.from("materiais").update(fields).eq("id", id);
  if (error) throw error;
  revalidatePath("/materiais");
}

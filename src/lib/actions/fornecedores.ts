"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface NovoFornecedorInput {
  nome: string;
  categoria?: string | null;
  telefone?: string | null;
  email?: string | null;
}

export async function createFornecedor(input: NovoFornecedorInput) {
  const supabase = await createClient();
  const { error } = await supabase.from("fornecedores").insert(input);
  if (error) throw error;
  revalidatePath("/fornecedores");
  revalidatePath("/financeiro");
}

export async function updateFornecedor(
  id: string,
  fields: Partial<{
    nome: string;
    categoria: string | null;
    telefone: string | null;
    email: string | null;
    ativo: boolean;
  }>
) {
  const supabase = await createClient();
  const { error } = await supabase.from("fornecedores").update(fields).eq("id", id);
  if (error) throw error;
  revalidatePath("/fornecedores");
}

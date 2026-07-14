"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface NovoItemOrcamentoInput {
  nome: string;
  tipo_cobranca: "m2" | "fixo";
  preco: number | null;
  categoria?: string | null;
}

export async function createItemOrcamento(input: NovoItemOrcamentoInput) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("itens_orcamento")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  revalidatePath("/materiais");
  revalidatePath("/servicos");
  return data;
}

export async function updateItemOrcamento(
  id: string,
  fields: Partial<{
    nome: string;
    tipo_cobranca: "m2" | "fixo";
    preco: number | null;
    categoria: string | null;
    ativo: boolean;
  }>
) {
  const supabase = await createClient();
  const { error } = await supabase.from("itens_orcamento").update(fields).eq("id", id);
  if (error) throw error;
  revalidatePath("/materiais");
}

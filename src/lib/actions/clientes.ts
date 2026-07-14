"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ClienteStatus } from "@/lib/domain/types";

export interface NovoClienteInput {
  nome: string;
  empresa?: string | null;
  cpf_cnpj?: string | null;
  cidade?: string | null;
  endereco?: string | null;
  whatsapp?: string | null;
  observacoes?: string | null;
  status?: ClienteStatus;
}

export async function createCliente(input: NovoClienteInput) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clientes")
    .insert({ status: "pre_cadastro", ...input })
    .select("id")
    .single();
  if (error) throw error;
  revalidatePath("/clientes");
  return data.id as string;
}

export async function updateClienteStatus(clienteId: string, status: ClienteStatus) {
  const supabase = await createClient();
  const { error } = await supabase.from("clientes").update({ status }).eq("id", clienteId);
  if (error) throw error;
  revalidatePath("/clientes");
}

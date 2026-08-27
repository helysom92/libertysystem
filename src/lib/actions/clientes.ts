"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ClienteStatus } from "@/lib/domain/types";
import { revalidateServicoPaths } from "./revalidateServicos";
import { requireRole } from "@/lib/domain/permissions";

export interface NovoClienteInput {
  nome: string;
  empresa?: string | null;
  cpf_cnpj?: string | null;
  cidade?: string | null;
  endereco?: string | null;
  whatsapp?: string | null;
  whatsapp_2?: string | null;
  email?: string | null;
  observacoes?: string | null;
  status?: ClienteStatus;
}

export async function createCliente(input: NovoClienteInput) {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  // Nome + WhatsApp já são obrigatórios pra criar um cliente — com os dois preenchidos, o
  // cadastro nasce Regularizado direto, sem exigir um passo manual extra depois.
  const defaultStatus: ClienteStatus = input.whatsapp ? "regularizado" : "pre_cadastro";
  const { data, error } = await supabase
    .from("clientes")
    .insert({ status: defaultStatus, ...input })
    .select("id")
    .single();
  if (error) throw error;
  revalidatePath("/secretaria/clientes");
  revalidateServicoPaths();
  return data.id as string;
}

export async function updateClienteStatus(clienteId: string, status: ClienteStatus) {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { error } = await supabase.from("clientes").update({ status }).eq("id", clienteId);
  if (error) throw error;
  revalidatePath("/secretaria/clientes");
  revalidateServicoPaths();
}

export interface DeleteResult {
  ok: boolean;
  reason?: string;
}

export async function deleteCliente(clienteId: string): Promise<DeleteResult> {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { count } = await supabase
    .from("servicos")
    .select("id", { count: "exact", head: true })
    .eq("cliente_id", clienteId);
  if (count && count > 0) {
    return {
      ok: false,
      reason: `Esse cliente tem ${count} serviço(s) vinculado(s) — não é possível excluir.`,
    };
  }
  const { error } = await supabase.from("clientes").delete().eq("id", clienteId);
  if (error) throw error;
  revalidatePath("/secretaria/clientes");
  revalidateServicoPaths();
  return { ok: true };
}

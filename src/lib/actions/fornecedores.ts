"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { revalidateFinanceiroPaths } from "./revalidateFinanceiro";
import { requireRole } from "@/lib/domain/permissions";
import type { AcaoResultado } from "./resultado";

export interface NovoFornecedorInput {
  nome: string;
  categoria?: string | null;
  telefone?: string | null;
  email?: string | null;
}

export async function createFornecedor(input: NovoFornecedorInput): Promise<AcaoResultado> {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { error } = await supabase.from("fornecedores").insert(input);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/secretaria/fornecedores");
  revalidateFinanceiroPaths();
  return { ok: true };
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
): Promise<AcaoResultado> {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { error } = await supabase.from("fornecedores").update(fields).eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/secretaria/fornecedores");
  revalidateFinanceiroPaths();
  return { ok: true };
}

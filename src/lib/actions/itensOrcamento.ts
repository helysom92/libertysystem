"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { revalidateServicoPaths } from "./revalidateServicos";
import { requireRole } from "@/lib/domain/permissions";
import type { AcaoResultado } from "./resultado";

export interface NovoItemOrcamentoInput {
  nome: string;
  tipo_cobranca: "m2" | "fixo";
  preco: number | null;
  categoria?: string | null;
}

export async function createItemOrcamento(input: NovoItemOrcamentoInput): Promise<AcaoResultado> {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { error } = await supabase.from("itens_orcamento").insert(input);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/secretaria/produtos");
  revalidateServicoPaths();
  return { ok: true };
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
): Promise<AcaoResultado> {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { error } = await supabase.from("itens_orcamento").update(fields).eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/secretaria/produtos");
  revalidateServicoPaths();
  return { ok: true };
}

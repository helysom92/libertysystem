"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/domain/permissions";
import type { AcaoResultado } from "./resultado";

export interface NovoMaterialInput {
  nome: string;
  unidade: "m2" | "metro_linear" | "unidade";
  preco_unitario: number;
  categoria?: string | null;
}

export async function createMaterial(input: NovoMaterialInput): Promise<AcaoResultado> {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { error } = await supabase.from("materiais").insert(input);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/secretaria/produtos");
  return { ok: true };
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
): Promise<AcaoResultado> {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { error } = await supabase.from("materiais").update(fields).eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/secretaria/produtos");
  return { ok: true };
}

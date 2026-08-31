"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { MetaTipo } from "@/lib/domain/dashboardMetrics";
import { requireRole } from "@/lib/domain/permissions";
import type { AcaoResultado } from "./resultado";

export async function updateMeta(tipo: MetaTipo, valorAlvo: number): Promise<AcaoResultado> {
  await requireRole("administrador");
  const supabase = await createClient();
  const { error } = await supabase
    .from("metas")
    .update({ valor_alvo: valorAlvo, atualizado_em: new Date().toISOString() })
    .eq("tipo", tipo);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/gestao");
  return { ok: true };
}

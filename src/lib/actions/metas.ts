"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { MetaTipo } from "@/lib/domain/dashboardMetrics";
import { requireRole } from "@/lib/domain/permissions";

export async function updateMeta(tipo: MetaTipo, valorAlvo: number) {
  await requireRole("administrador");
  const supabase = await createClient();
  const { error } = await supabase
    .from("metas")
    .update({ valor_alvo: valorAlvo, atualizado_em: new Date().toISOString() })
    .eq("tipo", tipo);
  if (error) throw error;
  revalidatePath("/gestao");
}

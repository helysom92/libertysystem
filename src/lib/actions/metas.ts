"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { MetaTipo } from "@/lib/domain/dashboardMetrics";

export async function updateMeta(tipo: MetaTipo, valorAlvo: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("metas")
    .update({ valor_alvo: valorAlvo, atualizado_em: new Date().toISOString() })
    .eq("tipo", tipo);
  if (error) throw error;
  revalidatePath("/dashboard");
}

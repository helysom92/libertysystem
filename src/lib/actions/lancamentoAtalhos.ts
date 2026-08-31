"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { revalidateFinanceiroPaths } from "./revalidateFinanceiro";
import { requireRole } from "@/lib/domain/permissions";
import type { AcaoResultado } from "./resultado";

export interface LancamentoAtalhoInput {
  descricao: string;
  categoria: string;
  fornecedor_id: string | null;
  forma_pagamento: string | null;
}

export async function createLancamentoAtalho(input: LancamentoAtalhoInput): Promise<AcaoResultado> {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { data: existentes } = await supabase
    .from("lancamento_atalhos")
    .select("ordem")
    .order("ordem", { ascending: false })
    .limit(1);
  const ordem = (existentes?.[0]?.ordem ?? -1) + 1;
  const { error } = await supabase.from("lancamento_atalhos").insert({ ...input, ordem });
  if (error) return { ok: false, message: error.message };
  revalidateFinanceiroPaths();
  return { ok: true };
}

export async function updateLancamentoAtalho(id: string, input: LancamentoAtalhoInput): Promise<AcaoResultado> {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { error } = await supabase.from("lancamento_atalhos").update(input).eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateFinanceiroPaths();
  return { ok: true };
}

export async function deleteLancamentoAtalho(id: string): Promise<AcaoResultado> {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { error } = await supabase.from("lancamento_atalhos").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateFinanceiroPaths();
  return { ok: true };
}

/** Lança um novo `lancamentos` (Despesa, realizado) a partir do molde do atalho — só pede
 * valor e data, o resto (descrição/categoria/fornecedor/forma de pagamento) já vem pronto. */
export async function lancarAtalho(atalhoId: string, fields: { valor: number; data: string }): Promise<AcaoResultado> {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();
  const { data: atalho, error: aErr } = await supabase
    .from("lancamento_atalhos")
    .select("descricao, categoria, fornecedor_id, forma_pagamento")
    .eq("id", atalhoId)
    .single();
  if (aErr || !atalho) return { ok: false, message: aErr?.message ?? "Atalho não encontrado." };

  const { error } = await supabase.from("lancamentos").insert({
    tipo: "Despesa",
    descricao: atalho.descricao,
    categoria: atalho.categoria,
    fornecedor_id: atalho.fornecedor_id,
    forma_pagamento: atalho.forma_pagamento,
    valor: fields.valor,
    data: fields.data,
    status: "realizado",
  });
  if (error) return { ok: false, message: error.message };

  revalidateFinanceiroPaths();
  revalidatePath("/hoje");
  return { ok: true };
}

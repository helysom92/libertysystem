"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/domain/permissions";
import { inicioDaSemana } from "@/lib/domain/revisaoSemanal";
import type { AcaoResultado } from "./resultado";

export interface RevisaoSalva {
  id: string;
  semana_inicio: string;
  revisado_em: string;
  revisado_por: string | null;
  observacao: string | null;
}

/** Últimas 12 semanas já confirmadas, mais recente primeiro. */
export async function listarRevisoes(): Promise<RevisaoSalva[]> {
  await requireRole("administrador");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("revisoes_semanais")
    .select("id, semana_inicio, revisado_em, revisado_por, observacao")
    .order("semana_inicio", { ascending: false })
    .limit(12);
  if (error) throw error;
  return (data as RevisaoSalva[]) ?? [];
}

export interface ConcluirRevisaoInput {
  semanaInicio: string;
  observacao: string | null;
  resumo: Record<string, unknown>;
}

/** Confirma a semana (uma por segunda-feira; confirmar de novo só atualiza o registro). */
export async function concluirRevisao(input: ConcluirRevisaoInput): Promise<AcaoResultado> {
  const profile = await requireRole("administrador");
  if (inicioDaSemana(input.semanaInicio) !== input.semanaInicio) {
    return { ok: false, message: "A semana precisa começar numa segunda-feira." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("revisoes_semanais").upsert(
    {
      semana_inicio: input.semanaInicio,
      revisado_em: new Date().toISOString(),
      revisado_por: profile.id,
      observacao: input.observacao?.trim() || null,
      resumo: input.resumo,
    },
    { onConflict: "semana_inicio" }
  );
  if (error) return { ok: false, message: error.message };
  revalidatePath("/gestao");
  revalidatePath("/hoje");
  return { ok: true };
}

export async function reabrirRevisao(semanaInicio: string): Promise<AcaoResultado> {
  await requireRole("administrador");
  const supabase = await createClient();
  const { error } = await supabase.from("revisoes_semanais").delete().eq("semana_inicio", semanaInicio);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/gestao");
  revalidatePath("/hoje");
  return { ok: true };
}

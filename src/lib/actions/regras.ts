"use server";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/domain/permissions";
import type { RegraLancamento } from "@/lib/domain/regras";
import type { UnidadeNegocio } from "@/lib/domain/types";
import type { AcaoResultado } from "./resultado";

export interface NovaRegraInput {
  padrao: string;
  tipo: "Receita" | "Despesa" | null;
  categoria: string | null;
  unidade_negocio: UnidadeNegocio | null;
  recorrencia: "nenhuma" | "mensal";
  valor_tipico: number | null;
}

export async function listarRegras(): Promise<RegraLancamento[]> {
  await requireRole("administrador");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("regras_lancamento")
    .select("*")
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return (data as RegraLancamento[]) ?? [];
}

export async function criarRegra(input: NovaRegraInput): Promise<AcaoResultado> {
  const profile = await requireRole("administrador");
  const padrao = input.padrao.trim();
  if (!padrao) return { ok: false, message: "Digite o nome (ou parte do nome) que identifica essa origem." };
  const supabase = await createClient();
  const { error } = await supabase.from("regras_lancamento").insert({
    padrao,
    tipo: input.tipo,
    categoria: input.categoria?.trim() || null,
    unidade_negocio: input.unidade_negocio,
    recorrencia: input.recorrencia,
    valor_tipico: input.valor_tipico,
    criado_por: profile.id,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function alternarRegra(id: string, ativo: boolean): Promise<AcaoResultado> {
  await requireRole("administrador");
  const supabase = await createClient();
  const { error } = await supabase.from("regras_lancamento").update({ ativo }).eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function excluirRegra(id: string): Promise<AcaoResultado> {
  await requireRole("administrador");
  const supabase = await createClient();
  const { error } = await supabase.from("regras_lancamento").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

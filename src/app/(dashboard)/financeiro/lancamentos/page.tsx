import { createClient } from "@/lib/supabase/server";
import { requireTab } from "@/lib/domain/permissions";
import type { Fornecedor, Lancamento } from "@/lib/domain/types";
import FluxoDiario from "@/components/financeiro/FluxoDiario";

export default async function FinanceiroLancamentosPage() {
  const profile = await requireTab("financeiro");
  const supabase = await createClient();
  const lancamentosQuery = supabase.from("lancamentos").select("*").order("data", { ascending: false });
  // Retirada de lucro é assunto de Administrador/Gestão — Secretaria não deve ver isso na
  // lista de lançamentos, mesmo tendo acesso total ao resto do Financeiro operacional.
  if (profile.role !== "administrador") {
    lancamentosQuery.neq("categoria", "Retirada de Lucro");
  }
  const [{ data: lancamentos }, { data: fornecedores }] = await Promise.all([
    lancamentosQuery,
    supabase.from("fornecedores").select("*").eq("ativo", true).order("nome"),
  ]);

  return (
    <FluxoDiario
      lancamentos={(lancamentos as Lancamento[]) ?? []}
      fornecedores={(fornecedores as Fornecedor[]) ?? []}
    />
  );
}

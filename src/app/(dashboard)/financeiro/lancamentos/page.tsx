import { createClient } from "@/lib/supabase/server";
import type { Fornecedor, Lancamento, LancamentoAtalho } from "@/lib/domain/types";
import FluxoDiario from "@/components/financeiro/FluxoDiario";

export default async function FinanceiroLancamentosPage() {
  const supabase = await createClient();
  const [{ data: lancamentos }, { data: fornecedores }, { data: atalhos }] = await Promise.all([
    supabase.from("lancamentos").select("*").order("data", { ascending: false }),
    supabase.from("fornecedores").select("*").eq("ativo", true).order("nome"),
    supabase.from("lancamento_atalhos").select("*").eq("ativo", true).order("ordem"),
  ]);

  return (
    <FluxoDiario
      lancamentos={(lancamentos as Lancamento[]) ?? []}
      fornecedores={(fornecedores as Fornecedor[]) ?? []}
      atalhos={(atalhos as LancamentoAtalho[]) ?? []}
    />
  );
}

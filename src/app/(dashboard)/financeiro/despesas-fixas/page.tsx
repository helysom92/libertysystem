import { createClient } from "@/lib/supabase/server";
import type { DespesaFixa, DespesaFixaOcorrencia, Fornecedor } from "@/lib/domain/types";
import DespesasFixasSection from "@/components/financeiro/DespesasFixasSection";

export default async function FinanceiroDespesasFixasPage() {
  const supabase = await createClient();
  const now = new Date();
  const ano = now.getFullYear();
  const mes = now.getMonth() + 1;

  const [{ data: despesas }, { data: fornecedores }] = await Promise.all([
    supabase.from("despesas_fixas").select("*").eq("ativo", true).order("dia_vencimento"),
    supabase.from("fornecedores").select("*").eq("ativo", true).order("nome"),
  ]);

  const despesasFixas = (despesas as DespesaFixa[]) ?? [];

  // Lazily ensure this month's occurrence row exists for every active despesa fixa.
  if (despesasFixas.length > 0) {
    await supabase.from("despesas_fixas_ocorrencias").upsert(
      despesasFixas.map((d) => ({ despesa_fixa_id: d.id, ano, mes, pago: false })),
      { onConflict: "despesa_fixa_id,ano,mes", ignoreDuplicates: true }
    );
  }

  const { data: ocorrencias } = await supabase
    .from("despesas_fixas_ocorrencias")
    .select("*")
    .eq("ano", ano)
    .eq("mes", mes);

  return (
    <DespesasFixasSection
      despesas={despesasFixas}
      ocorrencias={(ocorrencias as DespesaFixaOcorrencia[]) ?? []}
      fornecedores={(fornecedores as Fornecedor[]) ?? []}
      ano={ano}
      mes={mes}
    />
  );
}

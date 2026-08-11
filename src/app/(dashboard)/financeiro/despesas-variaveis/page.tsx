import { createClient } from "@/lib/supabase/server";
import type { DespesaVariavel, DespesaVariavelOcorrencia, Fornecedor } from "@/lib/domain/types";
import DespesasVariaveisSection from "@/components/financeiro/DespesasVariaveisSection";

export default async function FinanceiroDespesasVariaveisPage() {
  const supabase = await createClient();
  const now = new Date();
  const ano = now.getFullYear();
  const mes = now.getMonth() + 1;

  const [{ data: despesas }, { data: fornecedores }] = await Promise.all([
    supabase.from("despesas_variaveis").select("*").eq("ativo", true).order("descricao"),
    supabase.from("fornecedores").select("*").eq("ativo", true).order("nome"),
  ]);

  const despesasVariaveis = (despesas as DespesaVariavel[]) ?? [];

  // Lazily ensure this month's occurrence row exists, pré-preenchida com o valor provisionado.
  if (despesasVariaveis.length > 0) {
    await supabase.from("despesas_variaveis_ocorrencias").upsert(
      despesasVariaveis.map((d) => ({
        despesa_variavel_id: d.id,
        ano,
        mes,
        valor_real: d.valor_provisionado,
        pago: false,
      })),
      { onConflict: "despesa_variavel_id,ano,mes", ignoreDuplicates: true }
    );
  }

  const { data: ocorrencias } = await supabase
    .from("despesas_variaveis_ocorrencias")
    .select("*")
    .eq("ano", ano)
    .eq("mes", mes);

  return (
    <DespesasVariaveisSection
      despesas={despesasVariaveis}
      ocorrencias={(ocorrencias as DespesaVariavelOcorrencia[]) ?? []}
      fornecedores={(fornecedores as Fornecedor[]) ?? []}
      ano={ano}
      mes={mes}
    />
  );
}

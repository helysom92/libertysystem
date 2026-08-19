import { createClient } from "@/lib/supabase/server";
import type {
  DespesaFixa,
  DespesaFixaOcorrencia,
  DespesaVariavel,
  DespesaVariavelOcorrencia,
  Fornecedor,
  Lancamento,
  LancamentoAtalho,
} from "@/lib/domain/types";
import DespesasClient from "@/components/financeiro/DespesasClient";

export default async function FinanceiroDespesasPage() {
  const supabase = await createClient();
  const now = new Date();
  const ano = now.getFullYear();
  const mes = now.getMonth() + 1;

  const [
    { data: despesasFixasRaw },
    { data: despesasVarRaw },
    { data: fornecedores },
    { data: atalhos },
    { data: lancamentos },
  ] = await Promise.all([
    supabase.from("despesas_fixas").select("*").eq("ativo", true).order("dia_vencimento"),
    supabase.from("despesas_variaveis").select("*").eq("ativo", true).order("descricao"),
    supabase.from("fornecedores").select("*").eq("ativo", true).order("nome"),
    supabase.from("lancamento_atalhos").select("*").eq("ativo", true).order("ordem"),
    supabase.from("lancamentos").select("*").eq("tipo", "Despesa").order("data", { ascending: false }),
  ]);

  const despesasFixas = (despesasFixasRaw as DespesaFixa[]) ?? [];
  const despesasVariaveis = (despesasVarRaw as DespesaVariavel[]) ?? [];

  // Lazily ensure this month's occurrence row exists for every despesa ativa (fixa e variável).
  await Promise.all([
    despesasFixas.length > 0
      ? supabase.from("despesas_fixas_ocorrencias").upsert(
          despesasFixas.map((d) => ({ despesa_fixa_id: d.id, ano, mes, pago: false })),
          { onConflict: "despesa_fixa_id,ano,mes", ignoreDuplicates: true }
        )
      : Promise.resolve(),
    despesasVariaveis.length > 0
      ? supabase.from("despesas_variaveis_ocorrencias").upsert(
          despesasVariaveis.map((d) => ({
            despesa_variavel_id: d.id,
            ano,
            mes,
            valor_real: d.valor_provisionado,
            pago: false,
          })),
          { onConflict: "despesa_variavel_id,ano,mes", ignoreDuplicates: true }
        )
      : Promise.resolve(),
  ]);

  const [{ data: ocorrenciasFixas }, { data: ocorrenciasVar }] = await Promise.all([
    supabase.from("despesas_fixas_ocorrencias").select("*").eq("ano", ano).eq("mes", mes),
    supabase.from("despesas_variaveis_ocorrencias").select("*").eq("ano", ano).eq("mes", mes),
  ]);

  return (
    <DespesasClient
      despesasFixas={despesasFixas}
      ocorrenciasFixas={(ocorrenciasFixas as DespesaFixaOcorrencia[]) ?? []}
      despesasVariaveis={despesasVariaveis}
      ocorrenciasVariaveis={(ocorrenciasVar as DespesaVariavelOcorrencia[]) ?? []}
      fornecedores={(fornecedores as Fornecedor[]) ?? []}
      atalhos={(atalhos as LancamentoAtalho[]) ?? []}
      lancamentos={(lancamentos as Lancamento[]) ?? []}
      ano={ano}
      mes={mes}
    />
  );
}

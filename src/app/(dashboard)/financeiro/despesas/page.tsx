import { createClient } from "@/lib/supabase/server";
import type {
  DespesaFixa,
  DespesaFixaOcorrencia,
  DespesaVariavel,
  DespesaVariavelOcorrencia,
  Fornecedor,
  LancamentoAtalho,
} from "@/lib/domain/types";
import AtalhosLancamento from "@/components/financeiro/AtalhosLancamento";
import DespesasFixasSection from "@/components/financeiro/DespesasFixasSection";
import DespesasVariaveisSection from "@/components/financeiro/DespesasVariaveisSection";

export default async function FinanceiroDespesasPage() {
  const supabase = await createClient();
  const now = new Date();
  const ano = now.getFullYear();
  const mes = now.getMonth() + 1;

  const [{ data: despesasFixasRaw }, { data: despesasVarRaw }, { data: fornecedores }, { data: atalhos }] =
    await Promise.all([
      supabase.from("despesas_fixas").select("*").eq("ativo", true).order("dia_vencimento"),
      supabase.from("despesas_variaveis").select("*").eq("ativo", true).order("descricao"),
      supabase.from("fornecedores").select("*").eq("ativo", true).order("nome"),
      supabase.from("lancamento_atalhos").select("*").eq("ativo", true).order("ordem"),
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
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-xl font-bold">Despesas</h1>
        <p className="text-[13px] text-text-secondary">
          Lance e marque como pagas — tudo aparece em Lançamentos pra acompanhar e editar
        </p>
      </div>

      <AtalhosLancamento atalhos={(atalhos as LancamentoAtalho[]) ?? []} fornecedores={(fornecedores as Fornecedor[]) ?? []} />

      <DespesasFixasSection
        despesas={despesasFixas}
        ocorrencias={(ocorrenciasFixas as DespesaFixaOcorrencia[]) ?? []}
        fornecedores={(fornecedores as Fornecedor[]) ?? []}
        ano={ano}
        mes={mes}
      />

      <DespesasVariaveisSection
        despesas={despesasVariaveis}
        ocorrencias={(ocorrenciasVar as DespesaVariavelOcorrencia[]) ?? []}
        fornecedores={(fornecedores as Fornecedor[]) ?? []}
        ano={ano}
        mes={mes}
      />
    </div>
  );
}

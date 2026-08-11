import { createClient } from "@/lib/supabase/server";
import KpiCard from "@/components/hoje/KpiCard";
import { fmtBRL } from "@/lib/domain/types";
import type { Comprovante, DespesaFixa, DespesaFixaOcorrencia, Lancamento } from "@/lib/domain/types";

export default async function FinanceiroVisaoGeralPage() {
  const supabase = await createClient();
  const now = new Date();
  const ano = now.getFullYear();
  const mes = now.getMonth() + 1;

  const [{ data: lancamentos }, { data: comprovantes }, { data: despesas }, { data: ocorrencias }] =
    await Promise.all([
      supabase.from("lancamentos").select("tipo, valor, status"),
      supabase.from("comprovantes").select("status"),
      supabase.from("despesas_fixas").select("*").eq("ativo", true),
      supabase.from("despesas_fixas_ocorrencias").select("*").eq("ano", ano).eq("mes", mes),
    ]);

  const lancs = (lancamentos as Pick<Lancamento, "tipo" | "valor" | "status">[]) ?? [];
  const realizados = lancs.filter((l) => l.status === "realizado");
  const receitas = realizados.filter((l) => l.tipo === "Receita").reduce((a, l) => a + l.valor, 0);
  const despesasTotal = realizados.filter((l) => l.tipo === "Despesa").reduce((a, l) => a + l.valor, 0);
  const fluxoCaixa = receitas - despesasTotal;

  const comprovantesPendentes = ((comprovantes as Pick<Comprovante, "status">[]) ?? []).filter(
    (c) => c.status === "pendente"
  ).length;

  const despesasFixas = (despesas as DespesaFixa[]) ?? [];
  const ocorrenciasList = (ocorrencias as DespesaFixaOcorrencia[]) ?? [];
  const pagas = new Set(ocorrenciasList.filter((o) => o.pago).map((o) => o.despesa_fixa_id));
  const despesasFixasEmAberto = despesasFixas.filter((d) => !pagas.has(d.id)).length;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-xl font-bold">Visão Geral</h1>
        <p className="text-[13px] text-text-secondary">Receitas, despesas e pendências do mês</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Receitas" value={fmtBRL(receitas)} />
        <KpiCard label="Despesas" value={fmtBRL(despesasTotal)} />
        <KpiCard label="Fluxo de Caixa" value={fmtBRL(fluxoCaixa)} gold />
        <KpiCard label="Comprovantes Pendentes" value={comprovantesPendentes} />
        <KpiCard label="Despesas Fixas em Aberto" value={despesasFixasEmAberto} />
      </div>
    </div>
  );
}

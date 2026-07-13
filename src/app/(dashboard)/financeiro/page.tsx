import { createClient } from "@/lib/supabase/server";
import { fmtBRL } from "@/lib/domain/types";
import type { Comprovante, DespesaFixa, DespesaFixaOcorrencia, Lancamento } from "@/lib/domain/types";
import ComprovantesSection from "@/components/financeiro/ComprovantesSection";
import LancamentosTable from "@/components/financeiro/LancamentosTable";
import DespesasFixasSection from "@/components/financeiro/DespesasFixasSection";

export default async function FinanceiroPage() {
  const supabase = await createClient();

  const now = new Date();
  const ano = now.getFullYear();
  const mes = now.getMonth() + 1;

  const [{ data: lancamentos }, { data: comprovantes }, { data: despesas }] = await Promise.all([
    supabase.from("lancamentos").select("*").order("data", { ascending: false }),
    supabase.from("comprovantes").select("*").order("data", { ascending: false }),
    supabase.from("despesas_fixas").select("*").eq("ativo", true).order("dia_vencimento"),
  ]);

  const despesasFixas = (despesas as DespesaFixa[]) ?? [];

  // Lazily ensure this month's occurrence row exists for every active despesa fixa (plan §2).
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

  const lancs = (lancamentos as Lancamento[]) ?? [];
  const receitas = lancs.filter((l) => l.tipo === "Receita").reduce((a, l) => a + l.valor, 0);
  const despesasTotal = lancs.filter((l) => l.tipo === "Despesa").reduce((a, l) => a + l.valor, 0);
  const fluxoCaixa = receitas - despesasTotal;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-xl font-bold">Financeiro</h1>
        <p className="text-[13px] text-text-secondary">Receitas, despesas e comprovantes</p>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className="rounded-card border border-border-neutral bg-card p-4">
          <p className="mb-1 text-[10.5px] tracking-wide text-text-muted uppercase">Receitas</p>
          <p className="font-display text-xl font-bold">{fmtBRL(receitas)}</p>
        </div>
        <div className="rounded-card border border-border-neutral bg-card p-4">
          <p className="mb-1 text-[10.5px] tracking-wide text-text-muted uppercase">Despesas</p>
          <p className="font-display text-xl font-bold">{fmtBRL(despesasTotal)}</p>
        </div>
        <div className="rounded-card border border-border-neutral bg-card p-4">
          <p className="mb-1 text-[10.5px] tracking-wide text-text-muted uppercase">
            Fluxo de Caixa
          </p>
          <p className="font-display text-xl font-bold text-gradient-gold">{fmtBRL(fluxoCaixa)}</p>
        </div>
      </div>

      <div className="mb-5">
        <ComprovantesSection comprovantes={(comprovantes as Comprovante[]) ?? []} />
      </div>

      <div className="mb-5">
        <DespesasFixasSection
          despesas={despesasFixas}
          ocorrencias={(ocorrencias as DespesaFixaOcorrencia[]) ?? []}
          ano={ano}
          mes={mes}
        />
      </div>

      <LancamentosTable lancamentos={lancs} />
    </div>
  );
}

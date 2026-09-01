import { createClient } from "@/lib/supabase/server";
import { requireHelysom } from "@/lib/domain/permissions";
import type { ContaPessoal, InvestimentoPessoal, MovimentoInvestimentoPessoal } from "@/lib/domain/types";
import InvestimentosClient from "@/components/financas-pessoais/InvestimentosClient";
import ErroConsulta from "@/components/financeiro/ErroConsulta";

export default async function InvestimentosPessoaisPage() {
  const profile = await requireHelysom();
  const supabase = await createClient();

  let erro: string | null = null;
  let contas: ContaPessoal[] = [];
  let investimentos: InvestimentoPessoal[] = [];
  let movimentos: MovimentoInvestimentoPessoal[] = [];

  try {
    const [{ data: contasRaw, error: e1 }, { data: investimentosRaw, error: e2 }, { data: movimentosRaw, error: e3 }] = await Promise.all([
      supabase.from("contas_pessoais").select("*").eq("owner_id", profile.id).eq("ativa", true).order("nome"),
      supabase.from("investimentos_pessoais").select("*").eq("owner_id", profile.id).order("criado_em"),
      supabase.from("movimentos_investimento_pessoal").select("*").eq("owner_id", profile.id),
    ]);
    const primeiroErro = e1 ?? e2 ?? e3;
    if (primeiroErro) throw primeiroErro;

    contas = (contasRaw as ContaPessoal[]) ?? [];
    investimentos = (investimentosRaw as InvestimentoPessoal[]) ?? [];
    movimentos = (movimentosRaw as MovimentoInvestimentoPessoal[]) ?? [];
  } catch (err) {
    console.error("Falha ao carregar Investimentos (Finanças Pessoais)", err);
    erro = err instanceof Error ? err.message : "erro desconhecido";
  }

  if (erro) return <ErroConsulta mensagem={erro} />;

  return <InvestimentosClient contas={contas} investimentos={investimentos} movimentos={movimentos} />;
}

import { createClient } from "@/lib/supabase/server";
import { requireHelysom } from "@/lib/domain/permissions";
import type { ContaPessoal, OrigemReceitaPessoal, ReceitaPessoal, DespesaPessoal } from "@/lib/domain/types";
import ReceitasDespesasClient from "@/components/financas-pessoais/ReceitasDespesasClient";
import ErroConsulta from "@/components/financeiro/ErroConsulta";

export default async function ReceitasDespesasPessoaisPage() {
  const profile = await requireHelysom();
  const supabase = await createClient();

  let erro: string | null = null;
  let contas: ContaPessoal[] = [];
  let origens: OrigemReceitaPessoal[] = [];
  let receitas: ReceitaPessoal[] = [];
  let despesas: DespesaPessoal[] = [];

  try {
    const [{ data: contasRaw, error: e1 }, { data: origensRaw, error: e2 }, { data: receitasRaw, error: e3 }, { data: despesasRaw, error: e4 }] =
      await Promise.all([
        supabase.from("contas_pessoais").select("*").eq("owner_id", profile.id).eq("ativa", true).order("nome"),
        supabase.from("origens_receita_pessoal").select("*").eq("owner_id", profile.id).eq("ativo", true).order("nome"),
        supabase.from("receitas_pessoais").select("*").eq("owner_id", profile.id).order("data_prevista", { ascending: false }),
        supabase.from("despesas_pessoais").select("*").eq("owner_id", profile.id).order("vencimento", { ascending: false }),
      ]);
    const primeiroErro = e1 ?? e2 ?? e3 ?? e4;
    if (primeiroErro) throw primeiroErro;

    contas = (contasRaw as ContaPessoal[]) ?? [];
    origens = (origensRaw as OrigemReceitaPessoal[]) ?? [];
    receitas = (receitasRaw as ReceitaPessoal[]) ?? [];
    despesas = (despesasRaw as DespesaPessoal[]) ?? [];
  } catch (err) {
    console.error("Falha ao carregar Receitas e Despesas (Finanças Pessoais)", err);
    erro = err instanceof Error ? err.message : "erro desconhecido";
  }

  if (erro) return <ErroConsulta mensagem={erro} />;

  return <ReceitasDespesasClient contas={contas} origens={origens} receitasIniciais={receitas} despesasIniciais={despesas} />;
}

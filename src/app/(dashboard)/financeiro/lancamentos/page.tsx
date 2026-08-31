import { createClient } from "@/lib/supabase/server";
import { podeVerRetiradaDeLucro, requireTab } from "@/lib/domain/permissions";
import { resolverPeriodoDaUrl } from "@/lib/domain/periodoFinanceiro";
import { periodoDoMes } from "@/lib/domain/financas";
import type { Fornecedor, Lancamento, ServicoParaVinculo } from "@/lib/domain/types";
import FluxoDiario from "@/components/financeiro/FluxoDiario";
import ErroConsulta from "@/components/financeiro/ErroConsulta";

export default async function FinanceiroLancamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string; mes?: string; geral?: string }>;
}) {
  const params = await searchParams;
  const profile = await requireTab("financeiro");
  const supabase = await createClient();
  const { ano, mes } = resolverPeriodoDaUrl(params);
  const geral = params.geral === "1";
  const periodo = periodoDoMes(ano, mes);

  let erro: string | null = null;
  let dados: { lancamentos: Lancamento[]; fornecedores: Fornecedor[]; servicos: ServicoParaVinculo[] } | null = null;

  try {
    let lancamentosQuery = supabase.from("lancamentos").select("*").order("data", { ascending: false });
    if (!geral) {
      lancamentosQuery = lancamentosQuery.gte("data", periodo.inicio).lte("data", periodo.fim);
    }
    // Retirada de lucro é assunto de Administrador/Gestão — Secretaria não deve ver isso na
    // lista de lançamentos, mesmo tendo acesso total ao resto do Financeiro operacional.
    if (!podeVerRetiradaDeLucro(profile.role)) {
      lancamentosQuery = lancamentosQuery.neq("categoria", "Retirada de Lucro");
    }

    const [{ data: lancamentos, error: e1 }, { data: fornecedores, error: e2 }, { data: servicos, error: e3 }] =
      await Promise.all([
        lancamentosQuery,
        supabase.from("fornecedores").select("*").eq("ativo", true).order("nome"),
        supabase.from("servicos").select("id, numero, cliente, descricao").not("numero", "is", null),
      ]);
    const primeiroErro = e1 ?? e2 ?? e3;
    if (primeiroErro) throw primeiroErro;

    dados = {
      lancamentos: (lancamentos as Lancamento[]) ?? [],
      fornecedores: (fornecedores as Fornecedor[]) ?? [],
      servicos: (servicos as ServicoParaVinculo[]) ?? [],
    };
  } catch (err) {
    console.error("Falha ao carregar Lançamentos", err);
    erro = err instanceof Error ? err.message : "erro desconhecido";
  }

  if (erro || !dados) return <ErroConsulta mensagem={erro ?? "erro desconhecido"} />;

  return (
    <FluxoDiario
      lancamentos={dados.lancamentos}
      fornecedores={dados.fornecedores}
      servicos={dados.servicos}
      geral={geral}
      ano={ano}
      mes={mes}
    />
  );
}

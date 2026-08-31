import { createClient } from "@/lib/supabase/server";
import { requireHelysom } from "@/lib/domain/permissions";
import type { ContaPessoal, DividaPessoal, PagamentoDividaPessoal } from "@/lib/domain/types";
import DividasClient from "@/components/financas-pessoais/DividasClient";
import ErroConsulta from "@/components/financeiro/ErroConsulta";

export default async function DividasPessoaisPage() {
  const profile = await requireHelysom();
  const supabase = await createClient();

  let erro: string | null = null;
  let contas: ContaPessoal[] = [];
  let dividas: DividaPessoal[] = [];
  let pagamentos: PagamentoDividaPessoal[] = [];

  try {
    const [{ data: contasRaw, error: e1 }, { data: dividasRaw, error: e2 }, { data: pagamentosRaw, error: e3 }] = await Promise.all([
      supabase.from("contas_pessoais").select("*").eq("owner_id", profile.id).eq("ativa", true).order("nome"),
      supabase.from("dividas_pessoais").select("*").eq("owner_id", profile.id).order("criado_em", { ascending: false }),
      supabase.from("pagamentos_divida_pessoal").select("*").eq("owner_id", profile.id),
    ]);
    const primeiroErro = e1 ?? e2 ?? e3;
    if (primeiroErro) throw primeiroErro;

    contas = (contasRaw as ContaPessoal[]) ?? [];
    dividas = (dividasRaw as DividaPessoal[]) ?? [];
    pagamentos = (pagamentosRaw as PagamentoDividaPessoal[]) ?? [];
  } catch (err) {
    console.error("Falha ao carregar Dívidas (Finanças Pessoais)", err);
    erro = err instanceof Error ? err.message : "erro desconhecido";
  }

  if (erro) return <ErroConsulta mensagem={erro} />;

  return <DividasClient contas={contas} dividas={dividas} pagamentos={pagamentos} />;
}

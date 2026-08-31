import { createClient } from "@/lib/supabase/server";
import { requireHelysom } from "@/lib/domain/permissions";
import type { CartaoPessoal, CompraCartaoPessoal, DespesaPessoal } from "@/lib/domain/types";
import CartoesClient from "@/components/financas-pessoais/CartoesClient";
import ErroConsulta from "@/components/financeiro/ErroConsulta";

export default async function CartoesPessoaisPage() {
  const profile = await requireHelysom();
  const supabase = await createClient();

  let erro: string | null = null;
  let cartoes: CartaoPessoal[] = [];
  let compras: CompraCartaoPessoal[] = [];
  let despesasFatura: DespesaPessoal[] = [];

  try {
    const [{ data: cartoesRaw, error: e1 }, { data: comprasRaw, error: e2 }, { data: despesasRaw, error: e3 }] = await Promise.all([
      supabase.from("cartoes_pessoais").select("*").eq("owner_id", profile.id).order("criado_em"),
      supabase.from("compras_cartao_pessoal").select("*").eq("owner_id", profile.id).order("data_compra", { ascending: false }),
      supabase.from("despesas_pessoais").select("*").eq("owner_id", profile.id).not("cartao_id", "is", null),
    ]);
    const primeiroErro = e1 ?? e2 ?? e3;
    if (primeiroErro) throw primeiroErro;

    cartoes = (cartoesRaw as CartaoPessoal[]) ?? [];
    compras = (comprasRaw as CompraCartaoPessoal[]) ?? [];
    despesasFatura = (despesasRaw as DespesaPessoal[]) ?? [];
  } catch (err) {
    console.error("Falha ao carregar Cartões (Finanças Pessoais)", err);
    erro = err instanceof Error ? err.message : "erro desconhecido";
  }

  if (erro) return <ErroConsulta mensagem={erro} />;

  return <CartoesClient cartoes={cartoes} compras={compras} despesasFatura={despesasFatura} />;
}

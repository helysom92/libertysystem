import { createClient } from "@/lib/supabase/server";
import type { Cliente } from "@/lib/domain/types";
import SecretariaVisaoGeral from "@/components/secretaria/SecretariaVisaoGeral";

export default async function SecretariaVisaoGeralPage() {
  const supabase = await createClient();

  const [{ data: clientes }, { count: fornecedoresAtivosCount }, { count: produtosCount }] =
    await Promise.all([
      supabase.from("clientes").select("*").order("created_at", { ascending: false }),
      supabase.from("fornecedores").select("id", { count: "exact", head: true }).eq("ativo", true),
      supabase.from("itens_orcamento").select("id", { count: "exact", head: true }).eq("ativo", true),
    ]);

  return (
    <SecretariaVisaoGeral
      clientes={(clientes as Cliente[]) ?? []}
      fornecedoresAtivosCount={fornecedoresAtivosCount ?? 0}
      produtosCount={produtosCount ?? 0}
    />
  );
}

import { createClient } from "@/lib/supabase/server";
import { fetchAllClientes } from "@/lib/supabase/fetchAllClientes";
import SecretariaVisaoGeral from "@/components/secretaria/SecretariaVisaoGeral";

export default async function SecretariaVisaoGeralPage() {
  const supabase = await createClient();

  const [clientes, { count: fornecedoresAtivosCount }, { count: produtosCount }] =
    await Promise.all([
      fetchAllClientes(supabase, { column: "created_at", ascending: false }),
      supabase.from("fornecedores").select("id", { count: "exact", head: true }).eq("ativo", true),
      supabase.from("itens_orcamento").select("id", { count: "exact", head: true }).eq("ativo", true),
    ]);

  return (
    <SecretariaVisaoGeral
      clientes={clientes}
      fornecedoresAtivosCount={fornecedoresAtivosCount ?? 0}
      produtosCount={produtosCount ?? 0}
    />
  );
}

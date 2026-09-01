import { createClient } from "@/lib/supabase/server";
import { requireHelysom } from "@/lib/domain/permissions";
import type { ContaPessoal } from "@/lib/domain/types";
import ImportacoesClient from "@/components/financas-pessoais/ImportacoesClient";
import ErroConsulta from "@/components/financeiro/ErroConsulta";

export default async function ImportacoesPessoaisPage() {
  const profile = await requireHelysom();
  const supabase = await createClient();

  const { data: contasRaw, error } = await supabase
    .from("contas_pessoais")
    .select("*")
    .eq("owner_id", profile.id)
    .eq("ativa", true)
    .order("nome");
  if (error) return <ErroConsulta mensagem={error.message} />;

  return <ImportacoesClient contas={(contasRaw as ContaPessoal[]) ?? []} />;
}

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import RecebimentosClient, { type RecebimentoRow } from "@/components/financeiro/RecebimentosClient";

export default async function FinanceiroRecebimentosPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const [{ data: servicos }, { data: parcelas }] = await Promise.all([
    supabase
      .from("servicos")
      .select("id, numero, cliente, valor, valor_pago, financeiro_status, prazo, concluido, criado_em")
      .not("numero", "is", null)
      .order("criado_em", { ascending: false }),
    supabase.from("servico_parcelas").select("servico_id"),
  ]);

  const lancados = new Set((parcelas ?? []).map((p) => p.servico_id as string));
  const rows: RecebimentoRow[] = (servicos ?? []).map((s) => ({
    ...s,
    lancado: lancados.has(s.id),
  })) as RecebimentoRow[];

  return <RecebimentosClient servicos={rows} role={profile?.role ?? "secretaria"} />;
}

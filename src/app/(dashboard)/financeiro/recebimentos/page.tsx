import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import RecebimentosClient, { type RecebimentoRow } from "@/components/financeiro/RecebimentosClient";

export default async function FinanceiroRecebimentosPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const { data: servicos } = await supabase
    .from("servicos")
    .select("id, numero, cliente, valor, valor_pago, financeiro_status, prazo, concluido, criado_em")
    .not("numero", "is", null)
    .order("criado_em", { ascending: false });

  return (
    <RecebimentosClient
      servicos={(servicos as RecebimentoRow[]) ?? []}
      role={profile?.role ?? "secretaria"}
    />
  );
}

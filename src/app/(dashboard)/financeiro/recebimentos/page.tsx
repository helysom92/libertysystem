import { createClient } from "@/lib/supabase/server";
import { requireTab } from "@/lib/domain/permissions";
import type { Servico, ServicoParcela } from "@/lib/domain/types";
import RecebimentosClient from "@/components/financeiro/RecebimentosClient";

export default async function FinanceiroRecebimentosPage() {
  const profile = await requireTab("financeiro");
  const supabase = await createClient();

  const [{ data: servicosRaw }, { data: parcelasRaw }] = await Promise.all([
    supabase
      .from("servicos")
      .select("id, numero, cliente, valor, valor_pago, financeiro_status, prazo, concluido, criado_em")
      .not("numero", "is", null),
    supabase.from("servico_parcelas").select("*"),
  ]);

  const servicos = (servicosRaw as Pick<Servico, "id" | "numero" | "cliente" | "valor" | "valor_pago" | "financeiro_status" | "prazo" | "concluido" | "criado_em">[]) ?? [];
  const parcelas = (parcelasRaw as ServicoParcela[]) ?? [];

  return <RecebimentosClient servicos={servicos} parcelas={parcelas} role={profile.role} />;
}

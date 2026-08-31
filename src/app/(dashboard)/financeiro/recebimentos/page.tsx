import { createClient } from "@/lib/supabase/server";
import { requireTab } from "@/lib/domain/permissions";
import type { Servico, ServicoParcela } from "@/lib/domain/types";
import RecebimentosClient from "@/components/financeiro/RecebimentosClient";
import ErroConsulta from "@/components/financeiro/ErroConsulta";

type ServicoResumo = Pick<Servico, "id" | "numero" | "cliente" | "valor" | "valor_pago" | "financeiro_status" | "prazo" | "concluido" | "criado_em">;

export default async function FinanceiroRecebimentosPage() {
  const profile = await requireTab("financeiro");
  const supabase = await createClient();

  let erro: string | null = null;
  let dados: { servicos: ServicoResumo[]; parcelas: ServicoParcela[] } | null = null;

  try {
    const [{ data: servicosRaw, error: e1 }, { data: parcelasRaw, error: e2 }] = await Promise.all([
      supabase
        .from("servicos")
        .select("id, numero, cliente, valor, valor_pago, financeiro_status, prazo, concluido, criado_em")
        .not("numero", "is", null),
      supabase.from("servico_parcelas").select("*"),
    ]);
    const primeiroErro = e1 ?? e2;
    if (primeiroErro) throw primeiroErro;

    dados = {
      servicos: (servicosRaw as ServicoResumo[]) ?? [],
      parcelas: (parcelasRaw as ServicoParcela[]) ?? [],
    };
  } catch (err) {
    console.error("Falha ao carregar Recebimentos", err);
    erro = err instanceof Error ? err.message : "erro desconhecido";
  }

  if (erro || !dados) return <ErroConsulta mensagem={erro ?? "erro desconhecido"} />;

  return <RecebimentosClient servicos={dados.servicos} parcelas={dados.parcelas} role={profile.role} />;
}

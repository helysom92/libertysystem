import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { createClient } from "@/lib/supabase/server";
import { allowedTabs, homeTabFor } from "@/lib/domain/flows";
import { todayISO } from "@/lib/domain/dates";
import type {
  Cliente,
  DespesaFixa,
  DespesaFixaOcorrencia,
  Evento,
  ItemOrcamento,
  Lancamento,
  OrcamentoItemRow,
  Servico,
} from "@/lib/domain/types";
import type { Meta } from "@/lib/domain/dashboardMetrics";
import DashboardShell from "@/components/dashboard/DashboardShell";

export default async function AdministrativoPage() {
  const profile = await getCurrentProfile();
  const role = profile?.role ?? "secretaria";
  if (!allowedTabs(role).includes("administrativo")) {
    redirect(`/${homeTabFor(role)}`);
  }

  const supabase = await createClient();
  const [
    { data: servicos },
    { data: clientes },
    { data: lancamentos },
    { data: eventos },
    { data: despesasFixas },
    { data: despesasFixasOcorrencias },
    { data: orcamentoItens },
    { data: itensOrcamento },
    { data: metas },
  ] = await Promise.all([
    supabase.from("servicos").select("*"),
    supabase.from("clientes").select("*").order("nome"),
    supabase.from("lancamentos").select("*"),
    supabase.from("eventos").select("*"),
    supabase.from("despesas_fixas").select("*"),
    supabase.from("despesas_fixas_ocorrencias").select("*"),
    supabase.from("orcamento_itens").select("*"),
    supabase.from("itens_orcamento").select("*"),
    supabase.from("metas").select("*"),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-xl font-bold">Administrativo</h1>
        <p className="text-[13px] text-text-secondary">
          Painel administrativo — vendas, despesas, calendário e metas
        </p>
      </div>

      <DashboardShell
        hojeISO={todayISO()}
        servicos={(servicos as Servico[]) ?? []}
        clientes={(clientes as Cliente[]) ?? []}
        lancamentos={(lancamentos as Lancamento[]) ?? []}
        eventos={(eventos as Evento[]) ?? []}
        despesasFixas={(despesasFixas as DespesaFixa[]) ?? []}
        despesasFixasOcorrencias={(despesasFixasOcorrencias as DespesaFixaOcorrencia[]) ?? []}
        orcamentoItens={(orcamentoItens as OrcamentoItemRow[]) ?? []}
        itensOrcamento={(itensOrcamento as ItemOrcamento[]) ?? []}
        metas={(metas as Meta[]) ?? []}
      />
    </div>
  );
}

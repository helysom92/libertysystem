import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { createClient } from "@/lib/supabase/server";
import { fetchAllClientes } from "@/lib/supabase/fetchAllClientes";
import { allowedTabs, homeTabFor } from "@/lib/domain/flows";
import { todayISO } from "@/lib/domain/dates";
import type {
  Comprovante,
  DespesaFixa,
  DespesaFixaOcorrencia,
  Evento,
  FechamentoMensal,
  Fornecedor,
  ItemOrcamento,
  Lancamento,
  OrcamentoItemRow,
  Servico,
} from "@/lib/domain/types";
import type { Meta } from "@/lib/domain/dashboardMetrics";
import DashboardShell from "@/components/dashboard/DashboardShell";

export default async function GestaoPage() {
  const profile = await getCurrentProfile();
  const role = profile?.role ?? "secretaria";
  if (!allowedTabs(role).includes("gestao")) {
    redirect(`/${homeTabFor(role)}`);
  }

  const supabase = await createClient();
  const [
    { data: servicos },
    clientes,
    { data: lancamentos },
    { data: eventos },
    { data: despesasFixas },
    { data: despesasFixasOcorrencias },
    { data: orcamentoItens },
    { data: itensOrcamento },
    { data: metas },
    { data: fornecedores },
    { data: comprovantes },
    { data: fechamentos },
  ] = await Promise.all([
    supabase.from("servicos").select("*"),
    fetchAllClientes(supabase),
    supabase.from("lancamentos").select("*"),
    supabase.from("eventos").select("*"),
    supabase.from("despesas_fixas").select("*"),
    supabase.from("despesas_fixas_ocorrencias").select("*"),
    supabase.from("orcamento_itens").select("*"),
    supabase.from("itens_orcamento").select("*"),
    supabase.from("metas").select("*"),
    supabase.from("fornecedores").select("*"),
    supabase.from("comprovantes").select("*"),
    supabase.from("fechamentos_mensais").select("*").order("ano", { ascending: false }).order("mes", { ascending: false }),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-xl font-bold">Gestão</h1>
        <p className="text-[13px] text-text-secondary">
          Visão geral, relatórios e indicadores — números reais do negócio
        </p>
      </div>

      <DashboardShell
        hojeISO={todayISO()}
        servicos={(servicos as Servico[]) ?? []}
        clientes={clientes}
        lancamentos={(lancamentos as Lancamento[]) ?? []}
        eventos={(eventos as Evento[]) ?? []}
        despesasFixas={(despesasFixas as DespesaFixa[]) ?? []}
        despesasFixasOcorrencias={(despesasFixasOcorrencias as DespesaFixaOcorrencia[]) ?? []}
        orcamentoItens={(orcamentoItens as OrcamentoItemRow[]) ?? []}
        itensOrcamento={(itensOrcamento as ItemOrcamento[]) ?? []}
        metas={(metas as Meta[]) ?? []}
        fornecedores={(fornecedores as Fornecedor[]) ?? []}
        comprovantes={(comprovantes as Comprovante[]) ?? []}
        fechamentos={(fechamentos as FechamentoMensal[]) ?? []}
      />
    </div>
  );
}

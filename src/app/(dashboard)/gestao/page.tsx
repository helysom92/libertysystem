import { createClient } from "@/lib/supabase/server";
import { fetchAllClientes } from "@/lib/supabase/fetchAllClientes";
import { requireTab } from "@/lib/domain/permissions";
import { todayISO } from "@/lib/domain/dates";
import type {
  Comprovante,
  DespesaFixa,
  DespesaFixaOcorrencia,
  DespesaVariavel,
  DespesaVariavelOcorrencia,
  Evento,
  FechamentoMensal,
  Fornecedor,
  ItemOrcamento,
  Lancamento,
  OrcamentoItemRow,
  Servico,
  ServicoParcela,
} from "@/lib/domain/types";
import type { Meta } from "@/lib/domain/dashboardMetrics";
import type { Profile } from "@/lib/supabase/profile";
import DashboardShell from "@/components/dashboard/DashboardShell";

export default async function GestaoPage() {
  await requireTab("gestao");

  const supabase = await createClient();
  const [
    { data: servicos },
    clientes,
    { data: lancamentos },
    { data: eventos },
    { data: despesasFixas },
    { data: despesasFixasOcorrencias },
    { data: despesasVariaveis },
    { data: despesasVariaveisOcorrencias },
    { data: servicoParcelas },
    { data: orcamentoItens },
    { data: itensOrcamento },
    { data: metas },
    { data: fornecedores },
    { data: comprovantes },
    { data: fechamentos },
    { data: usuarios },
  ] = await Promise.all([
    supabase.from("servicos").select("*"),
    fetchAllClientes(supabase),
    supabase.from("lancamentos").select("*"),
    supabase.from("eventos").select("*"),
    supabase.from("despesas_fixas").select("*"),
    supabase.from("despesas_fixas_ocorrencias").select("*"),
    supabase.from("despesas_variaveis").select("*"),
    supabase.from("despesas_variaveis_ocorrencias").select("*"),
    supabase.from("servico_parcelas").select("*").is("cancelada_em", null),
    supabase.from("orcamento_itens").select("*"),
    supabase.from("itens_orcamento").select("*"),
    supabase.from("metas").select("*"),
    supabase.from("fornecedores").select("*"),
    supabase.from("comprovantes").select("*"),
    supabase.from("fechamentos_mensais").select("*").order("ano", { ascending: false }).order("mes", { ascending: false }),
    supabase.from("profiles").select("id, nome, role").order("nome"),
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
        despesasVariaveis={(despesasVariaveis as DespesaVariavel[]) ?? []}
        despesasVariaveisOcorrencias={(despesasVariaveisOcorrencias as DespesaVariavelOcorrencia[]) ?? []}
        servicoParcelas={(servicoParcelas as ServicoParcela[]) ?? []}
        orcamentoItens={(orcamentoItens as OrcamentoItemRow[]) ?? []}
        itensOrcamento={(itensOrcamento as ItemOrcamento[]) ?? []}
        metas={(metas as Meta[]) ?? []}
        fornecedores={(fornecedores as Fornecedor[]) ?? []}
        comprovantes={(comprovantes as Comprovante[]) ?? []}
        fechamentos={(fechamentos as FechamentoMensal[]) ?? []}
        usuarios={(usuarios as Profile[]) ?? []}
      />
    </div>
  );
}

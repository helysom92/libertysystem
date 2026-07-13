import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { computeKpisAdmin, computeKpisProducao } from "@/lib/domain/kpis";
import { computeIaAlerts } from "@/lib/domain/alerts";
import { ROLE_LABELS } from "@/lib/domain/flows";
import { fmtBRL } from "@/lib/domain/types";
import type { Comprovante, Servico } from "@/lib/domain/types";
import KpiCard from "@/components/hoje/KpiCard";
import MeuTrabalho from "@/components/hoje/MeuTrabalho";
import AlertasIA from "@/components/hoje/AlertasIA";

export default async function HojePage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const role = profile?.role ?? "secretaria";

  const [{ data: servicos }, { data: comprovantes }] = await Promise.all([
    supabase.from("servicos").select("*"),
    supabase.from("comprovantes").select("*"),
  ]);

  const svs = (servicos as Servico[]) ?? [];
  const comps = (comprovantes as Comprovante[]) ?? [];
  const alerts = computeIaAlerts(svs, comps);
  const today = new Date().toLocaleDateString("pt-BR");

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display text-xl font-bold">Hoje</h1>
          <p className="text-[13px] text-text-secondary">
            Visão geral · {ROLE_LABELS[role]}
          </p>
        </div>
        <span className="text-[13px] text-text-muted">{today}</span>
      </div>

      {role === "producao" ? (
        <ProducaoKpis servicos={svs} />
      ) : (
        <AdminKpis servicos={svs} />
      )}

      <div className="mt-5 grid grid-cols-2 gap-4">
        <MeuTrabalho servicos={svs} roleLabel={ROLE_LABELS[role]} />
        <AlertasIA alerts={alerts} />
      </div>
    </div>
  );
}

function AdminKpis({ servicos }: { servicos: Servico[] }) {
  const k = computeKpisAdmin(servicos);
  return (
    <div className="grid grid-cols-3 gap-3">
      <KpiCard label="Serviços Atrasados" value={k.atrasados} hint="Prazo vencido" />
      <KpiCard label="Double Check Pendente" value={k.dcPendente} hint="Aguardando validação" />
      <KpiCard label="Instalações Hoje" value={k.instalacoesHoje} hint="Agendadas para hoje" />
      <KpiCard label="Caixa Previsto" value={fmtBRL(k.caixaPrevisto)} hint="A receber dos serviços ativos" gold />
      <KpiCard
        label="Recebimentos Previstos"
        value={fmtBRL(k.recebimentosPrevistos)}
        hint="Próximos 7 dias"
        gold
      />
      <KpiCard
        label="Em Produção"
        value={k.emProducao}
        hint="Arquivo final, produção, acabamento e criação"
      />
    </div>
  );
}

function ProducaoKpis({ servicos }: { servicos: Servico[] }) {
  const k = computeKpisProducao(servicos);
  return (
    <div className="grid grid-cols-3 gap-3">
      <KpiCard label="OS Abertas" value={k.osAbertas} />
      <KpiCard label="Serviços Entregues (mês)" value={k.entreguesMes} />
      <KpiCard label="Instalações Hoje" value={k.instalacoesHoje} />
      <KpiCard label="Visitas Técnicas Pendentes" value={k.visitasTecnicasPendentes} />
      <KpiCard label="Em Produção" value={k.emProducao} />
      <KpiCard label="Double Check Pendente (Produção)" value={k.dcPendenteProducao} />
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { requireTab } from "@/lib/domain/permissions";
import { computeKpisAdmin, computeKpisProducao } from "@/lib/domain/kpis";
import { computeIaAlerts } from "@/lib/domain/alerts";
import { ROLE_LABELS } from "@/lib/domain/flows";
import { fmtBRL } from "@/lib/domain/types";
import type { Comprovante, Lancamento, Servico } from "@/lib/domain/types";
import { toServicoProducaoSafe } from "@/lib/domain/servicoProducao";
import KpiCard from "@/components/hoje/KpiCard";
import MeuTrabalho from "@/components/hoje/MeuTrabalho";
import AlertasIA from "@/components/hoje/AlertasIA";
import SemFinanceiroPosEntrega from "@/components/hoje/SemFinanceiroPosEntrega";

export default async function HojePage() {
  const profile = await requireTab("hoje");
  const role = profile.role;

  const supabase = await createClient();

  // Correção pontual: RLS de `servicos` só libera SELECT pra admin/secretaria agora — Produção
  // busca pela função segura (`listar_servicos_producao`, migration 0037).
  const [{ data: servicos }, { data: comprovantes }, { data: lancamentos }] = await Promise.all([
    role === "producao" ? supabase.rpc("listar_servicos_producao") : supabase.from("servicos").select("*"),
    role !== "producao" ? supabase.from("comprovantes").select("*") : Promise.resolve({ data: [] }),
    role !== "producao" ? supabase.from("lancamentos").select("*") : Promise.resolve({ data: [] }),
  ]);

  const svs =
    role === "producao"
      ? ((servicos ?? []) as unknown as Parameters<typeof toServicoProducaoSafe>[0][]).map(toServicoProducaoSafe)
      : ((servicos as unknown as Servico[]) ?? []);
  const comps = (comprovantes as Comprovante[]) ?? [];
  const lancs = (lancamentos as Lancamento[]) ?? [];
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

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MeuTrabalho servicos={svs} roleLabel={ROLE_LABELS[role]} />
        <AlertasIA alerts={alerts} />
      </div>

      {role !== "producao" && (
        <div className="mt-4">
          <SemFinanceiroPosEntrega servicos={svs} lancamentos={lancs} />
        </div>
      )}
    </div>
  );
}

function AdminKpis({ servicos }: { servicos: Servico[] }) {
  const k = computeKpisAdmin(servicos);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <KpiCard label="Serviços Atrasados" value={k.atrasados} hint="Prazo vencido" />
      <KpiCard label="Prazo Hoje" value={k.instalacoesHoje} hint="Serviços com prazo hoje" />
      <KpiCard label="Caixa Previsto" value={fmtBRL(k.caixaPrevisto)} hint="A receber dos serviços ativos" gold />
      <KpiCard
        label="Recebimentos Previstos"
        value={fmtBRL(k.recebimentosPrevistos)}
        hint="Próximos 7 dias"
        gold
      />
      <KpiCard label="Em Produção" value={k.emProducao} hint="Serviços aprovados em andamento" />
    </div>
  );
}

function ProducaoKpis({ servicos }: { servicos: Servico[] }) {
  const k = computeKpisProducao(servicos);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <KpiCard label="OS Abertas" value={k.osAbertas} />
      <KpiCard label="Serviços Entregues (mês)" value={k.entreguesMes} />
      <KpiCard label="Prazo Hoje" value={k.instalacoesHoje} />
      <KpiCard label="Em Produção" value={k.emProducao} />
    </div>
  );
}

import type { IaAlert } from "@/lib/domain/types";

export default function AlertasIA({ alerts }: { alerts: IaAlert[] }) {
  return (
    <div className="rounded-card border border-border-neutral bg-card p-4">
      <h3 className="mb-3 font-display text-sm font-bold">
        <span className="mr-1.5 text-gold">●</span>Alertas da IA
      </h3>
      {alerts.length === 0 && <p className="text-sm text-text-muted">Nenhum alerta no momento.</p>}
      <div className="flex flex-col gap-1">
        {alerts.map((a, i) => (
          <a
            key={i}
            href={a.servicoId ? `/servicos?open=${a.servicoId}` : "/financeiro"}
            className="rounded-btn px-2 py-1.5 text-[13px] hover:bg-card-secondary"
            style={{ color: a.color }}
          >
            ● {a.texto}
          </a>
        ))}
      </div>
    </div>
  );
}

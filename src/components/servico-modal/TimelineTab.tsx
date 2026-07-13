import type { ServicoDetail } from "@/lib/domain/types";

export default function TimelineTab({ detail }: { detail: ServicoDetail }) {
  return (
    <div className="flex flex-col gap-2">
      {detail.timeline.map((t) => (
        <div key={t.id} className="rounded-card border border-border-neutral bg-card-secondary px-3 py-2">
          <p className="text-[10.5px] text-text-muted">
            {new Date(t.criado_em).toLocaleString("pt-BR")}
          </p>
          <p className="text-[13px]">{t.texto}</p>
        </div>
      ))}
      {detail.timeline.length === 0 && <p className="text-sm text-text-muted">Sem histórico de etapas.</p>}
    </div>
  );
}

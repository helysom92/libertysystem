import type { ServicoDetail } from "@/lib/domain/types";

export default function HistoricoTab({ detail }: { detail: ServicoDetail }) {
  return (
    <div className="flex flex-col gap-2">
      {detail.historico.map((h) => (
        <div key={h.id} className="rounded-card border border-border-neutral bg-card-secondary px-3 py-2">
          <p className="text-[10.5px] text-text-muted">
            {new Date(h.criado_em).toLocaleString("pt-BR")}
          </p>
          <p className="text-[13px]">{h.texto}</p>
        </div>
      ))}
      {detail.historico.length === 0 && <p className="text-sm text-text-muted">Sem histórico.</p>}
    </div>
  );
}

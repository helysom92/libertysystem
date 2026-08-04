import { TIPO_LABELS } from "@/lib/domain/flows";
import type { Servico } from "@/lib/domain/types";

function categoria(servico: Servico): string {
  return TIPO_LABELS[servico.tipo];
}

export default function MeuTrabalho({
  servicos,
  roleLabel,
}: {
  servicos: Servico[];
  roleLabel: string;
}) {
  const meus = servicos.filter(
    (s) => s.estagio !== "Concluído" && s.proxima_responsavel === roleLabel
  );

  const groups = new Map<string, Servico[]>();
  for (const s of meus) {
    const cat = categoria(s);
    groups.set(cat, [...(groups.get(cat) ?? []), s]);
  }

  return (
    <div className="rounded-card border border-border-neutral bg-card p-4">
      <h3 className="mb-3 font-display text-sm font-bold">Meu Trabalho</h3>
      {groups.size === 0 && <p className="text-sm text-text-muted">Nada pendente no momento.</p>}
      <div className="flex flex-col gap-3">
        {[...groups.entries()].map(([cat, items]) => (
          <div key={cat}>
            <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-text-secondary uppercase">
              {cat} · {items.length}
            </p>
            <div className="flex flex-col gap-1">
              {items.map((s) => (
                <a
                  key={s.id}
                  href={`/servicos?open=${s.id}`}
                  className="rounded-btn px-2 py-1.5 text-[13px] hover:bg-card-secondary"
                >
                  {s.cliente} — {s.descricao}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

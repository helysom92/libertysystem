import type { Lancamento, Servico } from "@/lib/domain/types";

/** Ana's routine: "conferir se o financeiro foi lançado após a entrega" (plan §8). */
export default function SemFinanceiroPosEntrega({
  servicos,
  lancamentos,
}: {
  servicos: Servico[];
  lancamentos: Lancamento[];
}) {
  const pendentes = servicos.filter(
    (s) =>
      s.entrega_confirmada &&
      !lancamentos.some((l) => l.servico_id === s.id && l.tipo === "Receita")
  );

  return (
    <div className="rounded-card border border-border-neutral bg-card p-4">
      <h3 className="mb-3 font-display text-sm font-bold">Sem Financeiro Lançado Pós-Entrega</h3>
      {pendentes.length === 0 && (
        <p className="text-sm text-text-muted">Tudo certo — nenhuma pendência.</p>
      )}
      <div className="flex flex-col gap-1">
        {pendentes.map((s) => (
          <a
            key={s.id}
            href={`/servicos?open=${s.id}`}
            className="rounded-btn px-2 py-1.5 text-[13px] hover:bg-card-secondary"
          >
            {s.numero} — {s.cliente}
          </a>
        ))}
      </div>
    </div>
  );
}

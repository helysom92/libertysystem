import KpiCard from "@/components/hoje/KpiCard";
import type { Cliente } from "@/lib/domain/types";

const STATUS_LABEL: Record<Cliente["status"], string> = {
  regularizado: "Regularizado",
  pre_cadastro: "Pré-Cadastro",
  inativo: "Inativo",
};

export default function SecretariaVisaoGeral({
  clientes,
  fornecedoresAtivosCount,
  produtosCount,
}: {
  clientes: Cliente[];
  fornecedoresAtivosCount: number;
  produtosCount: number;
}) {
  const regularizados = clientes.filter((c) => c.status === "regularizado").length;
  const preCadastro = clientes.filter((c) => c.status === "pre_cadastro").length;
  const recentes = [...clientes]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 6);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-xl font-bold">Visão Geral</h1>
        <p className="text-[13px] text-text-secondary">Cadastros e acompanhamento do dia a dia</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Clientes Regularizados" value={regularizados} />
        <KpiCard
          label="Pré-Cadastro"
          value={preCadastro}
          hint={preCadastro > 0 ? "Completar dados pendente" : undefined}
        />
        <KpiCard label="Fornecedores Ativos" value={fornecedoresAtivosCount} />
        <KpiCard label="Itens no Catálogo" value={produtosCount} />
      </div>

      <div className="rounded-card border border-border-neutral bg-card p-4">
        <h3 className="mb-3 font-display text-sm font-bold">Últimos Cadastros</h3>
        {recentes.length === 0 ? (
          <p className="text-sm text-text-muted">Nenhum cliente cadastrado ainda.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {recentes.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-btn px-2 py-1.5 text-[13px] hover:bg-card-secondary"
              >
                <span>{c.nome}</span>
                <span className="text-[10.5px] tracking-wide text-text-muted uppercase">
                  {STATUS_LABEL[c.status]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

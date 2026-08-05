import { fmtBRL, type Lancamento } from "@/lib/domain/types";
import { fmtPct, type CategoriaFatia, type MonthPoint } from "@/lib/domain/dashboardMetrics";
import BarChart from "./charts/BarChart";
import DonutChart from "./charts/DonutChart";
import Pill from "./Pill";

export default function DespesasView({
  mesAtual,
  mesAnterior,
  monthly12,
  porCategoria,
  ultimosLancamentos,
}: {
  mesAtual: MonthPoint;
  mesAnterior: MonthPoint | null;
  monthly12: MonthPoint[];
  porCategoria: CategoriaFatia[];
  ultimosLancamentos: Lancamento[];
}) {
  const variacao =
    mesAnterior && mesAnterior.expenses > 0
      ? ((mesAtual.expenses - mesAnterior.expenses) / mesAnterior.expenses) * 100
      : null;
  const maiorCategoria = porCategoria[0]?.label ?? "—";

  return (
    <div>
      <div className="mb-5 grid grid-cols-3 gap-4">
        <div className="rounded-card border border-border-neutral bg-card-secondary p-4">
          <p className="text-[12px] font-semibold text-text-secondary">Despesas do mês</p>
          <p className="mt-1 font-display text-[20px] font-bold text-text">{fmtBRL(mesAtual.expenses)}</p>
        </div>
        <div className="rounded-card border border-border-neutral bg-card-secondary p-4">
          <p className="text-[12px] font-semibold text-text-secondary">Maior categoria</p>
          <p className="mt-1 font-display text-[16px] font-bold text-text">{maiorCategoria}</p>
        </div>
        <div className="rounded-card border border-border-neutral bg-card-secondary p-4">
          <p className="text-[12px] font-semibold text-text-secondary">Variação vs mês anterior</p>
          <p
            className="mt-1 font-display text-[20px] font-bold"
            style={{ color: variacao == null ? "var(--color-text-muted)" : variacao > 0 ? "var(--color-danger)" : "var(--color-success)" }}
          >
            {variacao == null ? "—" : `${variacao >= 0 ? "↑" : "↓"} ${fmtPct(Math.abs(variacao))}`}
          </p>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-[1fr_1.4fr] gap-4">
        <div className="rounded-card border border-border-neutral bg-card p-5">
          <p className="mb-4 font-display text-[15px] font-bold text-text">Despesas por categoria</p>
          <DonutChart fatias={porCategoria} fmt={fmtBRL} />
        </div>
        <div className="rounded-card border border-border-neutral bg-card p-5">
          <p className="mb-4 font-display text-[15px] font-bold text-text">Despesas — 12 meses</p>
          <BarChart
            series={[{ key: "expenses", label: "Despesas", color: "var(--color-text-secondary)" }]}
            data={monthly12.map((m) => ({ label: m.label, values: [m.expenses] }))}
            fmt={fmtBRL}
          />
        </div>
      </div>

      <div className="rounded-card border border-border-neutral bg-card p-5">
        <p className="mb-3 font-display text-[15px] font-bold text-text">Últimos lançamentos</p>
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="text-[11px] tracking-wide text-text-muted uppercase">
              <th className="px-1.5 py-2 font-semibold">Data</th>
              <th className="px-1.5 py-2 font-semibold">Categoria</th>
              <th className="px-1.5 py-2 font-semibold">Descrição</th>
              <th className="px-1.5 py-2 text-right font-semibold">Valor</th>
              <th className="px-1.5 py-2 text-right font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {ultimosLancamentos.map((l) => (
              <tr key={l.id} className="border-t border-border-neutral">
                <td className="px-1.5 py-2.5 text-text-secondary">{l.data.split("-").reverse().slice(0, 2).join("/")}</td>
                <td className="px-1.5 py-2.5 font-semibold text-text">{l.categoria || "Sem categoria"}</td>
                <td className="px-1.5 py-2.5 text-text">{l.descricao}</td>
                <td className="px-1.5 py-2.5 text-right font-semibold text-text">{fmtBRL(l.valor)}</td>
                <td className="px-1.5 py-2.5 text-right">
                  <Pill
                    label={l.status === "realizado" ? "Pago" : l.status === "previsto" ? "Pendente" : "Cancelado"}
                    color={l.status === "realizado" ? "#25D366" : l.status === "previsto" ? "#E0A64E" : "#E07A7A"}
                  />
                </td>
              </tr>
            ))}
            {ultimosLancamentos.length === 0 && (
              <tr>
                <td colSpan={5} className="px-1.5 py-6 text-center text-text-muted">
                  Nenhum lançamento de despesa ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

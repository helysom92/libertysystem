import { fmtBRL } from "@/lib/domain/types";
import { fmtPct, type CategoriaFatia, type MonthPoint, type TopItemCatalogo } from "@/lib/domain/dashboardMetrics";
import BarChart from "./charts/BarChart";
import DonutChart from "./charts/DonutChart";

export default function VendasView({
  mesAtual,
  mesAnterior,
  numPedidos,
  monthly12,
  porTipo,
  topItens,
}: {
  mesAtual: MonthPoint;
  mesAnterior: MonthPoint | null;
  numPedidos: number;
  monthly12: MonthPoint[];
  porTipo: CategoriaFatia[];
  topItens: TopItemCatalogo[];
}) {
  const ticketMedio = numPedidos > 0 ? mesAtual.sales / numPedidos : 0;
  const crescimento =
    mesAnterior && mesAnterior.sales > 0 ? ((mesAtual.sales - mesAnterior.sales) / mesAnterior.sales) * 100 : null;

  return (
    <div>
      <div className="mb-5 grid grid-cols-4 gap-4">
        <div className="rounded-card border border-border-neutral bg-card-secondary p-4">
          <p className="text-[12px] font-semibold text-text-secondary">Vendas do mês</p>
          <p className="mt-1 font-display text-[20px] font-bold text-text">{fmtBRL(mesAtual.sales)}</p>
        </div>
        <div className="rounded-card border border-border-neutral bg-card-secondary p-4">
          <p className="text-[12px] font-semibold text-text-secondary">Nº de serviços</p>
          <p className="mt-1 font-display text-[20px] font-bold text-text">{numPedidos}</p>
        </div>
        <div className="rounded-card border border-border-neutral bg-card-secondary p-4">
          <p className="text-[12px] font-semibold text-text-secondary">Ticket médio</p>
          <p className="mt-1 font-display text-[20px] font-bold text-text">{fmtBRL(ticketMedio)}</p>
        </div>
        <div className="rounded-card border border-border-neutral bg-card-secondary p-4">
          <p className="text-[12px] font-semibold text-text-secondary">Crescimento MoM</p>
          <p
            className="mt-1 font-display text-[20px] font-bold"
            style={{ color: crescimento == null ? "var(--color-text-muted)" : crescimento >= 0 ? "var(--color-success)" : "var(--color-danger)" }}
          >
            {crescimento == null ? "—" : `${crescimento >= 0 ? "↑" : "↓"} ${fmtPct(Math.abs(crescimento))}`}
          </p>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-[1.4fr_1fr] gap-4">
        <div className="rounded-card border border-border-neutral bg-card p-5">
          <p className="mb-4 font-display text-[15px] font-bold text-text">Vendas — 12 meses</p>
          <BarChart
            series={[{ key: "sales", label: "Vendas", color: "var(--color-gold)" }]}
            data={monthly12.map((m) => ({ label: m.label, values: [m.sales] }))}
            fmt={fmtBRL}
          />
        </div>
        <div className="rounded-card border border-border-neutral bg-card p-5">
          <p className="mb-4 font-display text-[15px] font-bold text-text">Vendas por tipo de serviço</p>
          <DonutChart fatias={porTipo} fmt={fmtBRL} />
        </div>
      </div>

      <div className="rounded-card border border-border-neutral bg-card p-5">
        <p className="mb-3 font-display text-[15px] font-bold text-text">Top itens do catálogo</p>
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="text-[11px] tracking-wide text-text-muted uppercase">
              <th className="px-1.5 py-2 font-semibold">Item</th>
              <th className="px-1.5 py-2 font-semibold">Quantidade</th>
              <th className="px-1.5 py-2 text-right font-semibold">Receita</th>
            </tr>
          </thead>
          <tbody>
            {topItens.map((p) => (
              <tr key={p.nome} className="border-t border-border-neutral">
                <td className="px-1.5 py-2.5 font-semibold text-text">{p.nome}</td>
                <td className="px-1.5 py-2.5 text-text-secondary">{p.quantidade}</td>
                <td className="px-1.5 py-2.5 text-right font-semibold text-text">{fmtBRL(p.receita)}</td>
              </tr>
            ))}
            {topItens.length === 0 && (
              <tr>
                <td colSpan={3} className="px-1.5 py-6 text-center text-text-muted">
                  Sem itens de orçamento vendidos neste período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

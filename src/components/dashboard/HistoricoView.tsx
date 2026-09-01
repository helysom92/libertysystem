import { fmtBRL } from "@/lib/domain/types";
import { fmtPct, type HistoricoRow } from "@/lib/domain/dashboardMetrics";
import ProgressBar from "./charts/ProgressBar";

export default function HistoricoView({ rows }: { rows: HistoricoRow[] }) {
  return (
    <div className="rounded-card border border-border-neutral bg-card p-5">
      <p className="mb-4 font-display text-[15px] font-bold text-text">Histórico — últimos 12 meses</p>
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="text-[11px] tracking-wide text-text-muted uppercase">
            <th className="px-1.5 py-2 font-semibold">Mês</th>
            <th className="px-1.5 py-2 text-right font-semibold">Vendas</th>
            <th className="px-1.5 py-2 text-right font-semibold">Despesas</th>
            <th className="px-1.5 py-2 text-right font-semibold">Resultado</th>
            <th className="px-1.5 py-2 text-right font-semibold">Margem</th>
            <th className="px-1.5 py-2 font-semibold">Tendência</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-border-neutral">
              <td className="px-1.5 py-2.5 font-semibold text-text">{r.label}</td>
              <td className="px-1.5 py-2.5 text-right text-text-secondary">{fmtBRL(r.sales)}</td>
              <td className="px-1.5 py-2.5 text-right text-text-secondary">{fmtBRL(r.expenses)}</td>
              <td className="px-1.5 py-2.5 text-right font-semibold text-text">{fmtBRL(r.profit)}</td>
              <td className="px-1.5 py-2.5 text-right text-text-secondary">{fmtPct(r.margin)}</td>
              <td className="px-1.5 py-2.5">
                <ProgressBar pct={r.barPct} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

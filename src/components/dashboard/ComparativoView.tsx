"use client";

import { fmtBRL } from "@/lib/domain/types";
import { fmtPct, type CompareRow, type MonthPoint } from "@/lib/domain/dashboardMetrics";

export default function ComparativoView({
  monthly,
  indexA,
  indexB,
  onChangeA,
  onChangeB,
  compareBars,
}: {
  monthly: MonthPoint[];
  indexA: number;
  indexB: number;
  onChangeA: (i: number) => void;
  onChangeB: (i: number) => void;
  compareBars: CompareRow[];
}) {
  const max = Math.max(1, ...compareBars.flatMap((b) => [b.aValor, b.bValor])) * 1.2;
  const last6 = monthly.slice(-6);

  return (
    <div>
      <div className="mb-5 rounded-card border border-border-neutral bg-card p-5">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <p className="font-display text-[15px] font-bold text-text">Comparar meses</p>
          <select
            value={indexA}
            onChange={(e) => onChangeA(Number(e.target.value))}
            className="rounded-btn border border-border-neutral bg-card-secondary px-3 py-1.5 text-[13px]"
          >
            {monthly.map((m, i) => (
              <option key={i} value={i}>
                {m.label}
              </option>
            ))}
          </select>
          <span className="text-[13px] text-text-secondary">vs</span>
          <select
            value={indexB}
            onChange={(e) => onChangeB(Number(e.target.value))}
            className="rounded-btn border border-border-neutral bg-card-secondary px-3 py-1.5 text-[13px]"
          >
            {monthly.map((m, i) => (
              <option key={i} value={i}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end gap-10 px-2" style={{ height: 170 }}>
          {compareBars.map((b) => (
            <div key={b.label} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex items-end gap-2.5" style={{ height: 140 }}>
                <div className="relative flex flex-col items-center">
                  <span className="mb-1 text-[11px] font-semibold text-text">{fmtBRL(b.aValor)}</span>
                  <div
                    style={{ width: 36, borderRadius: "6px 6px 0 0", background: "var(--color-text-muted)", height: `${(b.aValor / max) * 140}px` }}
                  />
                </div>
                <div className="relative flex flex-col items-center">
                  <span className="mb-1 text-[11px] font-semibold text-text">{fmtBRL(b.bValor)}</span>
                  <div
                    style={{ width: 36, borderRadius: "6px 6px 0 0", background: "var(--color-gold)", height: `${(b.bValor / max) * 140}px` }}
                  />
                </div>
              </div>
              <span className="text-[12px] font-semibold text-text-secondary">{b.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-center gap-5">
          <div className="flex items-center gap-1.5 text-[12px] text-text-secondary">
            <span className="h-2 w-2 rounded-sm" style={{ background: "var(--color-text-muted)" }} />
            {monthly[indexA]?.label}
          </div>
          <div className="flex items-center gap-1.5 text-[12px] text-text-secondary">
            <span className="h-2 w-2 rounded-sm" style={{ background: "var(--color-gold)" }} />
            {monthly[indexB]?.label}
          </div>
        </div>
      </div>

      <div className="rounded-card border border-border-neutral bg-card p-5">
        <p className="mb-3 font-display text-[15px] font-bold text-text">Últimos 6 meses</p>
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="text-[11px] tracking-wide text-text-muted uppercase">
              <th className="px-1.5 py-2 font-semibold">Mês</th>
              <th className="px-1.5 py-2 text-right font-semibold">Vendas</th>
              <th className="px-1.5 py-2 text-right font-semibold">Despesas</th>
              <th className="px-1.5 py-2 text-right font-semibold">Resultado</th>
              <th className="px-1.5 py-2 text-right font-semibold">Margem</th>
              <th className="px-1.5 py-2 text-right font-semibold">Δ vendas</th>
            </tr>
          </thead>
          <tbody>
            {last6.map((m, i) => {
              const prev = monthly[monthly.length - 6 + i - 1];
              const profit = m.sales - m.expenses;
              const margin = m.sales > 0 ? (profit / m.sales) * 100 : 0;
              const delta = prev && prev.sales > 0 ? ((m.sales - prev.sales) / prev.sales) * 100 : null;
              return (
                <tr key={m.key} className="border-t border-border-neutral">
                  <td className="px-1.5 py-2.5 font-semibold text-text">{m.label}</td>
                  <td className="px-1.5 py-2.5 text-right text-text-secondary">{fmtBRL(m.sales)}</td>
                  <td className="px-1.5 py-2.5 text-right text-text-secondary">{fmtBRL(m.expenses)}</td>
                  <td className="px-1.5 py-2.5 text-right font-semibold text-text">{fmtBRL(profit)}</td>
                  <td className="px-1.5 py-2.5 text-right text-text-secondary">{fmtPct(margin)}</td>
                  <td
                    className="px-1.5 py-2.5 text-right font-semibold"
                    style={{ color: delta == null ? "var(--color-text-muted)" : delta >= 0 ? "var(--color-success)" : "var(--color-danger)" }}
                  >
                    {delta == null ? "—" : `${delta >= 0 ? "↑" : "↓"} ${fmtPct(Math.abs(delta))}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

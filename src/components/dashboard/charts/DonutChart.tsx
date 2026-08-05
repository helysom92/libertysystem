import type { CategoriaFatia } from "@/lib/domain/dashboardMetrics";

export default function DonutChart({
  fatias,
  fmt,
  size = 120,
}: {
  fatias: CategoriaFatia[];
  fmt: (v: number) => string;
  size?: number;
}) {
  let acc = 0;
  const stops = fatias.map((f) => {
    const start = acc;
    acc += f.pct;
    return `${f.color} ${start}% ${acc}%`;
  });
  const gradient = fatias.length > 0 ? `conic-gradient(${stops.join(", ")})` : "var(--color-border-neutral)";

  return (
    <div className="flex items-center gap-5">
      <div
        style={{ width: size, height: size, borderRadius: "50%", flex: "none", background: gradient }}
      />
      <div className="flex flex-col gap-2">
        {fatias.length === 0 && <p className="text-[12px] text-text-muted">Sem dados no período.</p>}
        {fatias.map((f) => (
          <div key={f.label} className="flex items-center gap-2 text-[12px] text-text" title={fmt(f.valor)}>
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: f.color }} />
            {f.label} — {f.pct.toFixed(0)}%
          </div>
        ))}
      </div>
    </div>
  );
}

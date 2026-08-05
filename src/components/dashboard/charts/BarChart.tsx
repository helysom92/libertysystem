export interface BarSeriesDef {
  key: string;
  label: string;
  color: string;
}

export interface BarChartPoint {
  label: string;
  values: number[]; // aligned to `series` order
}

export default function BarChart({
  series,
  data,
  height = 150,
  fmt,
}: {
  series: BarSeriesDef[];
  data: BarChartPoint[];
  height?: number;
  fmt: (v: number) => string;
}) {
  const max = Math.max(1, ...data.flatMap((d) => d.values)) * 1.15;

  return (
    <div>
      <div className="flex items-end gap-3" style={{ height }}>
        {data.map((d, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex items-end gap-1" style={{ height: height - 20 }}>
              {d.values.map((v, si) => (
                <div
                  key={si}
                  title={`${series[si]?.label ?? ""}: ${fmt(v)}`}
                  style={{
                    width: series.length > 1 ? 12 : "100%",
                    maxWidth: 22,
                    minHeight: v > 0 ? 3 : 0,
                    borderRadius: "4px 4px 0 0",
                    background: series[si]?.color ?? "var(--color-gold)",
                    height: `${(v / max) * 100}%`,
                  }}
                />
              ))}
            </div>
            <span className="text-[10.5px] text-text-muted">{d.label}</span>
          </div>
        ))}
      </div>
      {series.length > 1 && (
        <div className="mt-3 flex gap-4">
          {series.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5 text-[11.5px] text-text-secondary">
              <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

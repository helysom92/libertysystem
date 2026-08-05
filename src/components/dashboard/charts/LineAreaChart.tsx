export default function LineAreaChart({
  points,
  labels,
  fmt,
  height = 150,
}: {
  points: number[];
  labels: string[];
  fmt: (v: number) => string;
  height?: number;
}) {
  const w = 640;
  const h = 160;
  const pad = 8;
  const max = Math.max(1, ...points) * 1.15;
  const min = Math.min(0, ...points);
  const range = max - min || 1;
  const stepX = points.length > 1 ? (w - 2 * pad) / (points.length - 1) : 0;

  const coords = points.map((v, i) => [pad + i * stepX, h - pad - ((v - min) / range) * (h - 2 * pad)]);
  const polyline = coords.map(([x, y]) => `${x},${y}`).join(" ");
  const areaPath = `M${pad},${h - pad} L${coords.map(([x, y]) => `${x},${y}`).join(" L")} L${w - pad},${h - pad} Z`;

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height }}>
        <path d={areaPath} fill="var(--color-gold)" opacity={0.15} />
        <polyline
          points={polyline}
          fill="none"
          stroke="var(--color-gold)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {coords.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={7} fill="transparent">
            <title>{`${labels[i]}: ${fmt(points[i])}`}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex justify-between">
        {labels.map((l, i) => (
          <span key={i} className="text-[10px] text-text-muted">
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

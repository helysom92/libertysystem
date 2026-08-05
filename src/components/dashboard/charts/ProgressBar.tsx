export default function ProgressBar({
  pct,
  color = "var(--color-gold)",
  height = 10,
}: {
  pct: number;
  color?: string;
  height?: number;
}) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div
      style={{ height, borderRadius: height / 2, background: "var(--color-border-neutral)", width: "100%" }}
    >
      <div
        style={{
          height: "100%",
          borderRadius: height / 2,
          background: color,
          width: `${clamped}%`,
          transition: "width 0.2s ease",
        }}
      />
    </div>
  );
}

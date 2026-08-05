export default function ProgressRing({
  pct,
  label,
  size = 66,
  thickness = 8,
}: {
  pct: number;
  label: string;
  size?: number;
  thickness?: number;
}) {
  const clamped = Math.min(100, Math.max(0, pct));
  const inner = size - thickness * 2;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flex: "none",
        background: `conic-gradient(var(--color-gold) 0% ${clamped}%, var(--color-border-neutral) ${clamped}% 100%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      title={`${Math.round(clamped)}%`}
    >
      <div
        style={{
          width: inner,
          height: inner,
          borderRadius: "50%",
          background: "var(--color-card)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        className="text-[12px] font-bold text-gold"
      >
        {label}
      </div>
    </div>
  );
}

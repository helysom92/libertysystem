export default function KpiCard({
  label,
  value,
  hint,
  gold,
}: {
  label: string;
  value: string | number;
  hint?: string;
  gold?: boolean;
}) {
  return (
    <div className="rounded-card border border-border-neutral bg-card p-4">
      <p className="mb-2 text-[10.5px] tracking-wide text-text-muted uppercase">{label}</p>
      <p className={`font-display text-2xl font-bold ${gold ? "text-gradient-gold" : ""}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-[11.5px] text-text-muted">{hint}</p>}
    </div>
  );
}

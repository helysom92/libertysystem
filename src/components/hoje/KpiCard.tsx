import Link from "next/link";

export default function KpiCard({
  label,
  value,
  hint,
  gold,
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  gold?: boolean;
  href?: string;
}) {
  const content = (
    <>
      <p className="mb-2 text-[10.5px] tracking-wide text-text-muted uppercase">{label}</p>
      <p className={`font-display text-2xl font-bold ${gold ? "text-gradient-gold" : ""}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-[11.5px] text-text-muted">{hint}</p>}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-card border border-border-neutral bg-card p-4 transition-colors hover:border-border-gold-strong hover:bg-card-secondary"
      >
        {content}
      </Link>
    );
  }

  return <div className="rounded-card border border-border-neutral bg-card p-4">{content}</div>;
}

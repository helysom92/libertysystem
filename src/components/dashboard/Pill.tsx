export default function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="rounded-pill px-2.5 py-0.5 text-[10.5px] font-semibold"
      style={{ color, backgroundColor: `${color}22`, border: `1px solid ${color}55` }}
    >
      {label}
    </span>
  );
}

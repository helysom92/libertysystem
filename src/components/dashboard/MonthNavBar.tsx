export default function MonthNavBar({
  label,
  onPrev,
  onNext,
  disableNext,
  isCurrent,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  disableNext: boolean;
  isCurrent?: boolean;
}) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <button
        type="button"
        onClick={onPrev}
        className="rounded-btn border border-border-neutral px-3 py-1.5 text-sm text-text-secondary hover:text-text"
      >
        ‹
      </button>
      <p className="min-w-[150px] text-center font-display text-[15px] font-bold text-text">
        {label}
        {isCurrent && <span className="ml-1.5 text-[11px] font-semibold text-gold">· atual</span>}
      </p>
      <button
        type="button"
        onClick={onNext}
        disabled={disableNext}
        className="rounded-btn border border-border-neutral px-3 py-1.5 text-sm text-text-secondary hover:text-text disabled:opacity-30"
      >
        ›
      </button>
    </div>
  );
}

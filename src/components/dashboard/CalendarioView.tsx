import Link from "next/link";
import { fmtBRL } from "@/lib/domain/types";
import type { CalendarCell, CalendarEvent } from "@/lib/domain/dashboardMetrics";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function CalendarioView({
  monthLabel,
  cells,
  onPrev,
  onNext,
  onToday,
  onSelectDay,
  selectedDateLabel,
  selectedDayEvents,
  agendaHref,
}: {
  monthLabel: string;
  cells: CalendarCell[];
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onSelectDay: (dateStr: string) => void;
  selectedDateLabel: string;
  selectedDayEvents: CalendarEvent[];
  /** Quando ausente (ex: calendário financeiro pessoal, que não tem Agenda própria), o link some. */
  agendaHref?: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
      <div className="rounded-card border border-border-neutral bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-display text-[16px] font-bold text-text">{monthLabel}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToday}
              className="rounded-btn border border-border-neutral px-3 py-1.5 text-[12px] font-semibold text-gold"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={onPrev}
              className="flex h-8 w-8 items-center justify-center rounded-btn border border-border-neutral font-bold text-gold"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={onNext}
              className="flex h-8 w-8 items-center justify-center rounded-btn border border-border-neutral font-bold text-gold"
            >
              ›
            </button>
          </div>
        </div>

        <div className="mb-1.5 grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-1.5 text-center text-[11px] font-semibold text-text-muted">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((c, i) => (
            <button
              type="button"
              key={i}
              disabled={!c.dateStr}
              onClick={() => c.dateStr && onSelectDay(c.dateStr)}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-btn text-[13px]"
              style={{
                background: c.isSelected ? "var(--color-gold)" : c.isToday ? "var(--color-card-secondary)" : "transparent",
                color: c.isSelected ? "#1b1712" : "var(--color-text)",
                opacity: c.inMonth ? 1 : 0.35,
                fontWeight: c.isToday ? 700 : 500,
                cursor: c.dateStr ? "pointer" : "default",
              }}
            >
              {c.day}
              <span className="flex h-1.5 gap-0.5">
                {c.hasVencimento && <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.isSelected ? "#1b1712" : "var(--color-text)" }} />}
                {c.hasCompromisso && <span className="h-1.5 w-1.5 rounded-full bg-gold" />}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-4 flex gap-4">
          <div className="flex items-center gap-1.5 text-[12px] text-text-secondary">
            <span className="h-2 w-2 rounded-full" style={{ background: "var(--color-text)" }} />
            Vencimento
          </div>
          <div className="flex items-center gap-1.5 text-[12px] text-text-secondary">
            <span className="h-2 w-2 rounded-full bg-gold" />
            Compromisso
          </div>
        </div>
      </div>

      <div className="rounded-card border border-border-neutral bg-card-secondary p-5">
        <p className="mb-0.5 font-display text-[15px] font-bold text-text">Agenda</p>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-[13px] text-text-secondary">{selectedDateLabel}</p>
          {agendaHref && (
            <Link href={agendaHref} className="text-[11.5px] font-semibold text-gold hover:underline">
              Abrir na Agenda →
            </Link>
          )}
        </div>
        {selectedDayEvents.length === 0 && (
          <p className="text-[13px] text-text-muted">Nenhum compromisso ou vencimento nesta data.</p>
        )}
        <div className="flex flex-col gap-2.5">
          {selectedDayEvents.map((ev, i) => (
            <div key={i} className="rounded-card bg-card p-3.5">
              <p className="mb-1 text-[11px] font-semibold" style={{ color: ev.tipo === "vencimento" ? "var(--color-text)" : "var(--color-gold)" }}>
                {ev.tipo === "vencimento" ? "Vencimento" : "Compromisso"}
              </p>
              <p className="text-[13px] font-semibold text-text">{ev.titulo}</p>
              {ev.valor != null && <p className="mt-1.5 text-[13px] font-semibold text-gold">{fmtBRL(ev.valor)}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

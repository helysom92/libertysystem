export function todayISO(): string {
  const d = new Date();
  return toISODate(d);
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(isoDate: string, delta: number): string {
  const d = new Date(isoDate + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return toISODate(d);
}

export function fmtDatePtBR(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function fmtDateLabel(isoDate: string): string {
  const today = todayISO();
  if (isoDate === today) return "HOJE";
  if (isoDate === addDays(today, 1)) return "AMANHÃ";
  if (isoDate === addDays(today, -1)) return "ONTEM";
  const d = new Date(isoDate + "T00:00:00");
  return d
    .toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" })
    .toUpperCase();
}

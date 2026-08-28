/** Fuso da operação (Mato Grosso do Sul) — usado onde precisamos ler o mês/dia de um
 * `timestamptz` de forma confiável, independente do fuso do processo Node/Vercel (que pode
 * ser UTC por padrão e faria um timestamp de fim de noite em MS "vazar" pro dia/mês seguinte). */
export const FUSO_OPERACAO = "America/Campo_Grande";

export function todayISO(): string {
  const d = new Date();
  return toISODate(d);
}

/** "Hoje" no fuso da operação (MS), não no fuso do processo Node/Vercel — usar em qualquer
 * comparação nova de vencido/a-vencer (Etapa 3) em vez de `todayISO()`, que depende do fuso do
 * servidor. */
export function hojeISOOperacao(timeZone: string = FUSO_OPERACAO): string {
  return isoDateFromTimestampTz(new Date().toISOString(), timeZone);
}

/** "YYYY-MM-DD" a partir de um `timestamptz`, sempre no fuso da operação — não usar
 * `.slice(0,10)` direto na string do timestamp, que reflete o fuso em que o Postgres/Supabase
 * serializou o valor (UTC), não o fuso real do evento. */
export function isoDateFromTimestampTz(isoTimestamp: string, timeZone: string = FUSO_OPERACAO): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(isoTimestamp));
  const ano = partes.find((p) => p.type === "year")!.value;
  const mes = partes.find((p) => p.type === "month")!.value;
  const dia = partes.find((p) => p.type === "day")!.value;
  return `${ano}-${mes}-${dia}`;
}

/** "YYYY-MM" a partir de um `timestamptz` (ex: `aprovado_em`, `criado_em`), sempre no fuso da
 * operação — não usar `.slice(0,7)` direto na string do timestamp, que reflete o fuso em que o
 * Postgres/Supabase serializou o valor (UTC), não o fuso real do evento. */
export function yearMonthKeyTz(isoTimestamp: string, timeZone: string = FUSO_OPERACAO): string {
  return isoDateFromTimestampTz(isoTimestamp, timeZone).slice(0, 7);
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

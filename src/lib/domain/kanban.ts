import { addDays, todayISO } from "./dates";

export type KanbanBoardKey = "orcamento" | "os";

export interface Coluna {
  id: string;
  board: KanbanBoardKey;
  label: string;
  ordem: number;
  is_conclusao: boolean;
}

export type PrazoTipo = "balcao" | "fachada" | "complexo";

export const PRAZO_TIPO_INFO: Record<PrazoTipo, { label: string; dias: number; buffer: number }> = {
  balcao: { label: "Balcão · 48h", dias: 2, buffer: 1 },
  fachada: { label: "Fachada / instalação · 7 dias", dias: 7, buffer: 2 },
  complexo: { label: "Serviço complexo · 15 dias", dias: 15, buffer: 5 },
};

/** Data-fim sugerida a partir do início e do tipo de prazo. */
export function calcularPrazoFim(prazoInicio: string, tipo: PrazoTipo): string {
  return addDays(prazoInicio, PRAZO_TIPO_INFO[tipo].dias);
}

export type PrazoStatus = "green" | "yellow" | "red";

/** Semáforo do prazo: vermelho = atrasado, amarelo = dentro do buffer, verde = tranquilo. */
export function prazoStatus(
  tipo: PrazoTipo | null,
  prazoFim: string | null,
  hojeISO: string = todayISO()
): PrazoStatus | null {
  if (!tipo || !prazoFim) return null;
  const info = PRAZO_TIPO_INFO[tipo];
  const hoje = new Date(hojeISO + "T00:00:00");
  const fim = new Date(prazoFim + "T00:00:00");
  const diffDays = Math.round((fim.getTime() - hoje.getTime()) / 86_400_000);
  if (diffDays < 0) return "red";
  if (diffDays <= info.buffer) return "yellow";
  return "green";
}

export const PRAZO_STATUS_COLOR: Record<PrazoStatus, string> = {
  green: "#4ADE80",
  yellow: "#FBBF24",
  red: "#F87171",
};

export const PRAZO_STATUS_LABEL: Record<PrazoStatus, string> = {
  green: "No prazo",
  yellow: "Atenção",
  red: "Atrasado",
};

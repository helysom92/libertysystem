export type ServicoTipo =
  | "medida_instalacao"
  | "medida_sem_instalacao"
  | "simples"
  | "criacao";

export const TIPO_LABELS: Record<ServicoTipo, string> = {
  simples: "Serviço de Balcão",
  medida_instalacao: "Com medida + instalação",
  medida_sem_instalacao: "Com medida sem instalação",
  criacao: "Somente criação",
};

export function exigeMedida(tipo: ServicoTipo): boolean {
  return tipo === "medida_instalacao" || tipo === "medida_sem_instalacao";
}

export const FINANCEIRO_STATUSES = [
  "Não orçado",
  "Orçado",
  "Aguardando sinal",
  "Parcialmente pago",
  "Pago",
  "Vencido",
  "Cancelado",
  "Cortesia",
] as const;
export type FinanceiroStatus = (typeof FINANCEIRO_STATUSES)[number];

export const PRIORIDADES = ["Normal", "Alta", "Urgente"] as const;
export type Prioridade = (typeof PRIORIDADES)[number];

export type Role = "administrador" | "secretaria" | "producao";
export const ROLE_LABELS: Record<Role, string> = {
  administrador: "Administrador",
  secretaria: "Secretaria",
  producao: "Produção",
};

/** Fonte única de verdade de quais abas cada papel pode abrir — usado tanto pela Sidebar
 * (só esconde link) quanto pelos guards de rota (bloqueiam de verdade, ver permissions.ts).
 * `Record` sobre os 3 papéis: sem `else` implícito — um papel desconhecido não cai em admin
 * por acidente, cai em `[]` (ver `allowedTabs`). */
const ALLOWED_TABS: Record<Role, readonly string[]> = {
  administrador: ["gestao", "hoje", "secretaria", "comercial", "financeiro", "producao"],
  secretaria: ["hoje", "secretaria", "comercial", "financeiro", "producao"],
  producao: ["producao"],
};

const HOME_TAB: Record<Role, string> = {
  administrador: "hoje",
  secretaria: "hoje",
  producao: "producao",
};

export function allowedTabs(role: Role): string[] {
  return [...(ALLOWED_TABS[role] ?? [])];
}

/** Pra onde mandar quem tenta abrir uma tela que o papel dele não tem acesso. */
export function homeTabFor(role: Role): string {
  return HOME_TAB[role] ?? "hoje";
}

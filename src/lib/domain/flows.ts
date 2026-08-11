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

export function allowedTabs(role: Role): string[] {
  if (role === "secretaria") return ["hoje", "secretaria", "comercial", "producao"];
  if (role === "producao") return ["producao"];
  return ["gestao", "hoje", "secretaria", "comercial", "producao"];
}

/** Pra onde mandar quem tenta abrir uma tela que o papel dele não tem acesso. */
export function homeTabFor(role: Role): string {
  return role === "producao" ? "producao" : "hoje";
}

export type ServicoTipo =
  | "medida_instalacao"
  | "medida_sem_instalacao"
  | "simples"
  | "criacao";

export const TIPO_LABELS: Record<ServicoTipo, string> = {
  medida_instalacao: "Com medida + instalação",
  medida_sem_instalacao: "Com medida sem instalação",
  simples: "Serviço simples",
  criacao: "Somente criação",
};

export const FLOWS: Record<ServicoTipo, string[]> = {
  medida_instalacao: [
    "Lead",
    "Orçamento",
    "Aprovado",
    "Visita Técnica",
    "Double Check de Medidas",
    "Arquivo Final",
    "Produção",
    "Acabamento",
    "Instalação",
    "Entrega",
    "Concluído",
  ],
  medida_sem_instalacao: [
    "Lead",
    "Orçamento",
    "Aprovado",
    "Conferência de Medidas",
    "Double Check de Medidas",
    "Arquivo Final",
    "Produção",
    "Entrega",
    "Concluído",
  ],
  simples: ["Pedido", "Orçamento", "Aprovado", "Arquivo Final", "Produção", "Entrega", "Concluído"],
  criacao: [
    "Briefing",
    "Orçamento",
    "Aprovado",
    "Criação",
    "Aprovação do Cliente",
    "Arquivo Final",
    "Concluído",
  ],
};

export const MASTER_STAGE_ORDER = [
  "Briefing",
  "Pedido",
  "Lead",
  "Orçamento",
  "Aprovado",
  "Visita Técnica",
  "Conferência de Medidas",
  "Double Check de Medidas",
  "Criação",
  "Aprovação do Cliente",
  "Arquivo Final",
  "Produção",
  "Acabamento",
  "Instalação",
  "Entrega",
  "Concluído",
];

export function flowFor(tipo: ServicoTipo): string[] {
  return FLOWS[tipo] || FLOWS.simples;
}

export function exigeMedida(tipo: ServicoTipo): boolean {
  return tipo === "medida_instalacao" || tipo === "medida_sem_instalacao";
}

export const DC_ADMIN_LABELS = [
  "Medidas conferidas",
  "Proporção da arte",
  "Textos",
  "Posicionamento",
  "Aprovação do cliente",
  "Briefing x arte x medidas",
  "Arquivo final",
];

export const DC_PROD_LABELS = [
  "Dimensões",
  "Unidade",
  "Material",
  "Espessura",
  "Sangria",
  "Margem",
  "Acabamento",
  "Emendas",
  "Quantidade",
  "Estrutura/Fixação",
  "Viabilidade de produção",
];

export const STAGE_ACTIONS: Record<string, { acao: string; responsavel: string }> = {
  Briefing: { acao: "Fazer briefing com o cliente", responsavel: "Secretaria" },
  Pedido: { acao: "Confirmar pedido", responsavel: "Secretaria" },
  Lead: { acao: "Enviar orçamento", responsavel: "Secretaria" },
  Orçamento: { acao: "Aguardar aprovação do cliente", responsavel: "Secretaria" },
  Aprovado: { acao: "Iniciar próxima etapa", responsavel: "Secretaria" },
  "Visita Técnica": { acao: "Realizar visita técnica", responsavel: "Produção" },
  "Conferência de Medidas": { acao: "Conferir medidas", responsavel: "Produção" },
  "Double Check de Medidas": { acao: "Validar Double Check", responsavel: "Administrador" },
  Criação: { acao: "Criar arte", responsavel: "Produção" },
  "Aprovação do Cliente": { acao: "Aguardar aprovação da arte", responsavel: "Secretaria" },
  "Arquivo Final": { acao: "Fechar arquivo de produção", responsavel: "Produção" },
  Produção: { acao: "Produzir material", responsavel: "Produção" },
  Acabamento: { acao: "Fazer acabamento", responsavel: "Produção" },
  Instalação: { acao: "Instalar no cliente", responsavel: "Produção" },
  Entrega: { acao: "Confirmar entrega", responsavel: "Secretaria" },
  Concluído: { acao: "Nenhuma", responsavel: "—" },
};

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
  if (role === "secretaria") return ["hoje", "servicos", "agenda", "financeiro"];
  if (role === "producao") return ["hoje", "servicos", "agenda"];
  return ["hoje", "servicos", "agenda", "financeiro", "gestao"];
}

export interface DcItem {
  texto: string;
  done: boolean;
}

export function dcComplete(dcAdmin: DcItem[], dcProducao: DcItem[]): boolean {
  return dcAdmin.every((i) => i.done) && dcProducao.every((i) => i.done);
}

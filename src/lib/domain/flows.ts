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

const MASTER_FLOW = ["Orçamento", "Aprovado", "Concluído"];

export const FLOWS: Record<ServicoTipo, string[]> = {
  medida_instalacao: MASTER_FLOW,
  medida_sem_instalacao: MASTER_FLOW,
  simples: MASTER_FLOW,
  criacao: MASTER_FLOW,
};

export const MASTER_STAGE_ORDER = MASTER_FLOW;

/** Rótulo de exibição por etapa — o valor cru salvo no banco não muda. */
export const ESTAGIO_LABELS: Record<string, string> = {
  Orçamento: "Orçamento",
  Aprovado: "Ordem de Serviço (OS)",
  Concluído: "Concluído",
};

export function flowFor(tipo: ServicoTipo): string[] {
  return FLOWS[tipo] || FLOWS.simples;
}

const PRODUCAO_FISICA_STAGES = new Set(["Aprovado"]);

/** Coarse phase grouping for Kanban column coloring (plan §5, "cores por fase"). */
export function faseDaEtapa(estagio: string): "interno" | "producao" {
  return PRODUCAO_FISICA_STAGES.has(estagio) ? "producao" : "interno";
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
  Orçamento: { acao: "Aguardar aprovação do cliente", responsavel: "Secretaria" },
  Aprovado: { acao: "Executar serviço (produção/instalação)", responsavel: "Produção" },
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
  if (role === "secretaria")
    return [
      "hoje",
      "servicos",
      "agenda",
      "clientes",
      "fornecedores",
      "financeiro",
      "relatorios",
      "materiais",
    ];
  if (role === "producao") return ["hoje", "servicos", "agenda", "clientes"];
  return [
    "hoje",
    "dashboard",
    "servicos",
    "agenda",
    "clientes",
    "fornecedores",
    "financeiro",
    "relatorios",
    "materiais",
    "gestao",
  ];
}

export interface DcItem {
  texto: string;
  done: boolean;
}

export function dcComplete(dcAdmin: DcItem[], dcProducao: DcItem[]): boolean {
  return dcAdmin.every((i) => i.done) && dcProducao.every((i) => i.done);
}

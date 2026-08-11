import { emProducao, naoConcluidos } from "./kpis";
import { daysUntil, type Comprovante, type Servico } from "./types";

export interface BucketItem {
  id: string;
  cliente: string;
  descricao: string;
  numero: string | null;
}

export interface Bucket {
  titulo: string;
  items: BucketItem[];
  count: number;
  empty: boolean;
  borderColor: string;
  titleColor: string;
}

const DEFAULT_BORDER = "rgba(201,162,75,0.15)";
const DEFAULT_TITLE = "rgba(244,242,236,0.6)";

function bucket(
  titulo: string,
  servicos: Servico[],
  borderColor = DEFAULT_BORDER,
  titleColor = DEFAULT_TITLE
): Bucket {
  const items = servicos.map((s) => ({ id: s.id, cliente: s.cliente, descricao: s.descricao, numero: s.numero }));
  return { titulo, items, count: items.length, empty: items.length === 0, borderColor, titleColor };
}

export function computeGestaoBuckets(servicos: Servico[], comprovantes: Comprovante[]): Bucket[] {
  const naoConc = naoConcluidos(servicos);
  const atrasadosList = naoConc.filter((s) => {
    const d = daysUntil(s.prazo);
    return d !== null && d < 0;
  });
  const prazoVencendo = naoConc.filter((s) => {
    const d = daysUntil(s.prazo);
    return d !== null && d >= 0 && d <= 3;
  });
  const comprovantesPendentesItems: BucketItem[] = comprovantes
    .filter((c) => c.status === "pendente")
    .map((c) => ({
      id: c.id,
      cliente: c.banco ?? "—",
      descricao: c.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
      numero: null,
    }));

  return [
    bucket("Atrasados", atrasadosList, "rgba(220,90,90,0.35)", "#E07A7A"),
    bucket("Prazo Vencendo (3 dias)", prazoVencendo, "rgba(224,166,78,0.35)", "#E0A64E"),
    bucket(
      "Sem Próxima Ação",
      naoConc.filter((s) => !s.proxima_acao_texto)
    ),
    bucket(
      "Sem Responsável",
      naoConc.filter((s) => !s.responsavel)
    ),
    bucket(
      "Aguardando Cliente",
      servicos.filter((s) => s.numero == null)
    ),
    bucket("Aguardando Produção", emProducao(servicos)),
    bucket(
      "Saldo Pendente",
      servicos.filter((s) => s.valor_pago < s.valor && !s.concluido),
      "rgba(201,162,75,0.3)",
      "#C9A24B"
    ),
    {
      titulo: "Comprovante sem Conferência",
      items: comprovantesPendentesItems,
      count: comprovantesPendentesItems.length,
      empty: comprovantesPendentesItems.length === 0,
      borderColor: "rgba(201,162,75,0.3)",
      titleColor: "#C9A24B",
    },
    bucket(
      "Entregue e Não Encerrado",
      servicos.filter((s) => s.entrega_confirmada && !s.concluido),
      "rgba(224,166,78,0.35)",
      "#E0A64E"
    ),
  ];
}

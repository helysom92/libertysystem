import { emProducao, naoConcluidos, dcPendenteList } from "./kpis";
import { daysUntil, type Comprovante, type Servico } from "./types";

export interface BucketItem {
  id: string;
  cliente: string;
  descricao: string;
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
  const items = servicos.map((s) => ({ id: s.id, cliente: s.cliente, descricao: s.descricao }));
  return { titulo, items, count: items.length, empty: items.length === 0, borderColor, titleColor };
}

/**
 * Ported 1:1 from the prototype's 11 Gestão buckets (lines 1202-1215), plus the
 * decision-fix: "Double Check Pendente" also catches serviços that already advanced
 * past the DC stage and later had DC invalidated by a late file/measurement change
 * (dc_invalidated_after_advance) — the prototype had a gap here (see plan §4/§9e).
 */
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
  const dcPendente = dcPendenteList(servicos);
  const dcPendenteOuInvalidado = servicos.filter(
    (s) =>
      (s.estagio === "Double Check de Medidas" && dcPendente.includes(s)) ||
      s.dc_invalidated_after_advance
  );

  const comprovantesPendentesItems: BucketItem[] = comprovantes
    .filter((c) => c.status === "pendente")
    .map((c) => ({
      id: c.id,
      cliente: c.banco ?? "—",
      descricao: c.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
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
    bucket("Double Check Pendente", dcPendenteOuInvalidado, "rgba(224,166,78,0.35)", "#E0A64E"),
    bucket(
      "Aguardando Cliente",
      servicos.filter((s) => ["Orçamento", "Aprovação do Cliente"].includes(s.estagio))
    ),
    bucket("Aguardando Produção", emProducao(servicos)),
    bucket(
      "Aguardando Instalação",
      servicos.filter((s) => s.estagio === "Instalação")
    ),
    bucket(
      "Saldo Pendente",
      servicos.filter((s) => s.valor_pago < s.valor && s.estagio !== "Concluído"),
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
      servicos.filter((s) => s.entrega_confirmada && s.estagio !== "Concluído"),
      "rgba(224,166,78,0.35)",
      "#E0A64E"
    ),
  ];
}

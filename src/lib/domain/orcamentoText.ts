import { fmtBRL } from "./types";
import { CATEGORIA_PRAZO_INFO, type CategoriaPrazo, type ModoCalculoItem } from "./orcamento";

// Dados fixos da empresa, iguais ao cabeçalho do app "Orçamento Liberty".
const LIBERTY_TELEFONE = "(67) 99983-1562";
const LIBERTY_CNPJ = "57.663.033/0001-39";

export interface OrcamentoTextItem {
  descricao: string;
  categoriaPrazo: CategoriaPrazo;
  modoCalculo: ModoCalculoItem;
  itemNome?: string | null; // nome do item de catálogo, quando modoCalculo === 'catalogo'
  larguraCm?: number | null;
  alturaCm?: number | null;
  quantidade: number;
  area: number | null;
  unit: number;
  minimoAplicado: boolean;
  valorFinal: number;
}

export interface OrcamentoTextOptions {
  clienteNome: string;
  clienteTelefone?: string | null;
  local?: string | null;
  validadeDias: number;
  condicoes: { entrada50: boolean; cartao: boolean; desconto: boolean };
  observacoes?: string | null;
}

/** Porta generateText() do app Electron "Orçamento Liberty" (index.html linhas 653-720). */
export function buildOrcamentoText(itens: OrcamentoTextItem[], opts: OrcamentoTextOptions): string {
  const hoje = new Date().toLocaleDateString("pt-BR");
  const lines: string[] = [];

  lines.push("*ORÇAMENTO - LIBERTY VISUAL E MARKETING*");
  lines.push(`📞 ${LIBERTY_TELEFONE}`);
  lines.push(`CNPJ: ${LIBERTY_CNPJ}`);
  lines.push(`Data: ${hoje}`);
  lines.push("");
  lines.push(`*Cliente:* ${opts.clienteNome || "-"}`);
  if (opts.clienteTelefone) lines.push(`*Contato:* ${opts.clienteTelefone}`);
  if (opts.local) lines.push(`*Local:* ${opts.local}`);
  lines.push("");
  lines.push("------------------------------");

  let maxRank = 0;
  itens.forEach((item, idx) => {
    const info = CATEGORIA_PRAZO_INFO[item.categoriaPrazo];
    if (info.rank > maxRank) maxRank = info.rank;

    lines.push(`${idx + 1}. ${item.descricao || "(sem descrição)"} [${info.label}]`);

    if (item.modoCalculo === "catalogo") {
      if (item.area == null) {
        lines.push(`   ${item.itemNome ?? "-"} | Qtd: ${item.quantidade}`);
      } else {
        lines.push(
          `   ${item.itemNome ?? "-"} | ${(item.larguraCm ?? 0).toLocaleString("pt-BR")}cm x ${(item.alturaCm ?? 0).toLocaleString("pt-BR")}cm x ${item.quantidade}un = ${item.area.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} m²`
        );
      }
      if (item.minimoAplicado) lines.push(`   (pedido mínimo aplicado)`);
    } else if (item.modoCalculo === "m2_manual") {
      lines.push(
        `   ${(item.larguraCm ?? 0).toLocaleString("pt-BR")}cm x ${(item.alturaCm ?? 0).toLocaleString("pt-BR")}cm x ${item.quantidade}un = ${(item.area ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} m² (${fmtBRL(item.unit)}/m²)`
      );
    } else {
      lines.push(`   Qtd: ${item.quantidade} | Valor unit: ${fmtBRL(item.unit)}`);
    }
    lines.push(`   Valor: ${fmtBRL(item.valorFinal)}`);
    lines.push("");
  });

  lines.push("------------------------------");
  const total = itens.reduce((sum, item) => sum + item.valorFinal, 0);
  lines.push(`*TOTAL: ${fmtBRL(total)}*`);
  lines.push("");
  if (maxRank > 0) {
    const info = Object.values(CATEGORIA_PRAZO_INFO).find((s) => s.rank === maxRank);
    if (info) lines.push(`*Prazo estimado de entrega:* ${info.prazoLabel}`);
  }
  lines.push(`Validade da proposta: ${opts.validadeDias} dias`);

  if (opts.condicoes.entrada50) lines.push("50% na entrada e 50% do valor na entrega do serviço.");
  if (opts.condicoes.cartao) lines.push("Parcelamos no cartão, consulte as condições.");
  if (opts.condicoes.desconto) lines.push("Desconto especial à vista, no Pix ou dinheiro.");

  if (opts.observacoes) lines.push(opts.observacoes);
  lines.push("");
  lines.push("Agradecemos a preferência! 🙌");

  return lines.join("\n");
}

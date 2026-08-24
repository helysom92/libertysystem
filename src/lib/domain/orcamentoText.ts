import { fmtBRL } from "./types";
import {
  prazoEstimadoLabel,
  type CategoriaPrazo,
  type ModoCalculoItem,
  type OrcamentoItemCalculo,
} from "./orcamento";

// Dados fixos da empresa, iguais ao cabeçalho do app "Orçamento Liberty".
export const LIBERTY_TELEFONE = "(67) 99983-1562";
export const LIBERTY_CNPJ = "57.663.033/0001-39";
export const LIBERTY_ENDERECO = "Dr. Julio Siqueira Maia, 2161, Progresso";
export const LIBERTY_CIDADE = "Rio Brilhante - MS, 79.130-000";

/** Linha de detalhe curta de um item (ex. "90cm x 120cm x 1un = 1,08 m²"), pro documento visual. */
export function formatItemDetalhe(
  modoCalculo: ModoCalculoItem,
  calc: OrcamentoItemCalculo,
  opts: {
    itemNome?: string | null;
    larguraCm?: number | null;
    alturaCm?: number | null;
    quantidade: number;
    mostrarMedidaCliente?: boolean;
  }
): string {
  // Preço por m² normalmente exige mostrar a medida exata pra justificar o cálculo — mas
  // o usuário pode preferir esconder do cliente (evita que a medida vá parar num orçamento
  // concorrente). Quando escondida, mostra só o que não expõe a medida.
  if (opts.mostrarMedidaCliente === false) {
    if (modoCalculo === "catalogo") return opts.itemNome ?? "";
    return "";
  }
  if (modoCalculo === "catalogo") {
    if (calc.area == null) return `${opts.itemNome ?? "-"} · Qtd: ${opts.quantidade}`;
    return `${opts.itemNome ?? "-"} · ${opts.larguraCm ?? 0}cm x ${opts.alturaCm ?? 0}cm x ${opts.quantidade}un = ${calc.area.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} m²`;
  }
  if (modoCalculo === "m2_manual") {
    return `${opts.larguraCm ?? 0}cm x ${opts.alturaCm ?? 0}cm x ${opts.quantidade}un = ${(calc.area ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} m² (${fmtBRL(calc.unit)}/m²)`;
  }
  return `Qtd: ${opts.quantidade} · Valor unit: ${fmtBRL(calc.unit)}`;
}

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
  mostrarMedidaCliente: boolean;
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

  itens.forEach((item, idx) => {
    lines.push(`${idx + 1}. ${item.descricao || "(sem descrição)"}`);

    if (!item.mostrarMedidaCliente) {
      if (item.modoCalculo === "catalogo" && item.itemNome) lines.push(`   ${item.itemNome}`);
      if (item.minimoAplicado) lines.push(`   (pedido mínimo aplicado)`);
    } else if (item.modoCalculo === "catalogo") {
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
  const prazo = prazoEstimadoLabel(itens.map((i) => i.categoriaPrazo));
  if (prazo) lines.push(`*Prazo estimado de entrega:* ${prazo}`);
  lines.push(`Validade da proposta: ${opts.validadeDias} dias`);

  if (opts.condicoes.entrada50) lines.push("50% na entrada e 50% do valor na entrega do serviço.");
  if (opts.condicoes.cartao) lines.push("Parcelamos no cartão, consulte as condições.");
  if (opts.condicoes.desconto) lines.push("Desconto especial à vista, no Pix ou dinheiro.");

  if (opts.observacoes) lines.push(opts.observacoes);
  lines.push("");
  lines.push("Agradecemos a preferência! 🙌");

  return lines.join("\n");
}

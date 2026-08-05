import type { ItemOrcamento } from "./types";

// ── Regras de precificação Liberty (tabela de preços real) ─────────────
export const PEDIDO_MINIMO = 90;
export const FORMULA_MULTIPLICADOR_MINIMO = 3; // "nunca negociando abaixo de custo × 3"
export const FORMULA_MARGEM_REFERENCIA = 0.15; // +15% sobre custo × 3 para o valor de referência

export interface FormulaPersonalizadaResultado {
  valorMinimo: number; // custo × 3 — nunca negociar abaixo disso
  valorReferencia: number; // custo × 3 × 1.15 — valor sugerido
}

/** Fórmula de referência da Liberty para serviços sob projeto/não tabelados. */
export function calcularFormulaPersonalizada(custoDireto: number): FormulaPersonalizadaResultado {
  const valorMinimo = custoDireto * FORMULA_MULTIPLICADOR_MINIMO;
  const valorReferencia = valorMinimo * (1 + FORMULA_MARGEM_REFERENCIA);
  return { valorMinimo, valorReferencia };
}

// ── Item de orçamento (linha do construtor multi-item) ─────────────────
export type CategoriaPrazo = "balcao" | "simples" | "complexo";
export type ModoCalculoItem = "catalogo" | "formula" | "m2_manual";

export const CATEGORIA_PRAZO_INFO: Record<
  CategoriaPrazo,
  { label: string; prazoLabel: string; rank: number }
> = {
  balcao: { label: "Balcão", prazoLabel: "48 horas", rank: 1 },
  simples: { label: "Serviço simples", prazoLabel: "7 dias úteis", rank: 2 },
  complexo: { label: "Serviço complexo", prazoLabel: "15 dias úteis", rank: 3 },
};

export interface OrcamentoItemDraft {
  categoriaPrazo: CategoriaPrazo;
  modoCalculo: ModoCalculoItem;
  itemOrcamentoId: string | null; // modo 'catalogo'
  larguraCm: number;
  alturaCm: number;
  quantidade: number;
  custoDireto: number; // modo 'formula'
  precoM2Manual: number; // modo 'm2_manual'
}

export interface OrcamentoItemCalculo {
  area: number | null;
  sugerido: number;
  unit: number;
  minimoAplicado: boolean;
}

/**
 * Espelha calcSugerido() do app Electron "Orçamento Liberty" — fonte de verdade da
 * precificação real da empresa. Sem "área mínima": o único piso é o valor final
 * (PEDIDO_MINIMO), aplicado apenas no modo 'catalogo'.
 */
export function calcularItemOrcamento(
  draft: OrcamentoItemDraft,
  itensOrcamento: ItemOrcamento[]
): OrcamentoItemCalculo {
  const quantidade = draft.quantidade || 0;

  if (draft.modoCalculo === "catalogo") {
    const item = itensOrcamento.find((i) => i.id === draft.itemOrcamentoId);
    if (!item || item.preco == null) {
      return { area: null, sugerido: 0, unit: 0, minimoAplicado: false };
    }
    let area: number | null = null;
    let bruto: number;
    if (item.tipo_cobranca === "fixo") {
      bruto = item.preco * quantidade;
    } else {
      area = (draft.larguraCm / 100) * (draft.alturaCm / 100) * quantidade;
      bruto = area * item.preco;
    }
    const sugerido = Math.max(bruto, quantidade > 0 ? PEDIDO_MINIMO : 0);
    return { area, sugerido, unit: item.preco, minimoAplicado: quantidade > 0 && bruto < PEDIDO_MINIMO };
  }

  if (draft.modoCalculo === "m2_manual") {
    const area = (draft.larguraCm / 100) * (draft.alturaCm / 100) * quantidade;
    const sugerido = area * (draft.precoM2Manual || 0);
    return { area, sugerido, unit: draft.precoM2Manual || 0, minimoAplicado: false };
  }

  // modo 'formula'
  const unit = (draft.custoDireto || 0) * FORMULA_MULTIPLICADOR_MINIMO * (1 + FORMULA_MARGEM_REFERENCIA);
  return { area: null, sugerido: unit * quantidade, unit, minimoAplicado: false };
}

/** Maior prazo entre os itens do orçamento (rank mais alto vence), como texto pro cliente. */
export function prazoEstimadoLabel(categorias: CategoriaPrazo[]): string | null {
  const maxRank = categorias.reduce((max, c) => Math.max(max, CATEGORIA_PRAZO_INFO[c].rank), 0);
  return Object.values(CATEGORIA_PRAZO_INFO).find((c) => c.rank === maxRank)?.prazoLabel ?? null;
}

// ── Linha comercial da proposta (Promocional/Custo-Benefício/Premium) ──────
export type LinhaOrcamento = "promocional" | "custo_beneficio" | "premium";

export const LINHA_ORCAMENTO_INFO: Record<LinhaOrcamento, { label: string; sub: string; ring: string }> = {
  promocional: {
    label: "Linha Promocional",
    sub: "Opção de entrada, ótimo custo para resultado imediato.",
    ring: "#dcd3bd",
  },
  custo_beneficio: {
    label: "1ª Linha · Custo-Benefício",
    sub: "Melhor equilíbrio entre durabilidade e investimento.",
    ring: "#e8cf8a",
  },
  premium: {
    label: "Linha Premium",
    sub: "Máxima durabilidade e acabamento superior.",
    ring: "#c89b3c",
  },
};

export function novoItemOrcamentoDraft(categoriaPrazo: CategoriaPrazo = "balcao"): OrcamentoItemDraft {
  return {
    categoriaPrazo,
    modoCalculo: "catalogo",
    itemOrcamentoId: null,
    larguraCm: 0,
    alturaCm: 0,
    quantidade: 1,
    custoDireto: 0,
    precoM2Manual: 0,
  };
}

import type { ItemOrcamento, Material } from "./types";

export interface OrcamentoItem {
  materialId: string;
  quantidade: number; // m² para unidade 'm2', metros para 'metro_linear', unidades para 'unidade'
}

export interface OrcamentoResultado {
  custoMaterial: number;
  valorBase: number;
}

/**
 * Cálculo por material bruto (custo × mão-de-obra% × margem%) — usado para itens
 * fora do catálogo de preços quando não se quer aplicar a fórmula de referência.
 */
export function calcularOrcamento(
  itens: OrcamentoItem[],
  materiais: Material[],
  maoDeObraPct: number,
  margemPct: number
): OrcamentoResultado {
  const custoMaterial = itens.reduce((acc, item) => {
    const material = materiais.find((m) => m.id === item.materialId);
    if (!material) return acc;
    return acc + item.quantidade * material.preco_unitario;
  }, 0);

  const valorBase = custoMaterial * (1 + maoDeObraPct / 100) * (1 + margemPct / 100);

  return { custoMaterial, valorBase };
}

// ── Regras de precificação Liberty (tabela de preços real) ─────────────
export const PEDIDO_MINIMO = 80;
export const AREA_MINIMA_M2 = 1;
export const FORMULA_MULTIPLICADOR_MINIMO = 3; // "nunca negociando abaixo de custo × 3"
export const FORMULA_MARGEM_REFERENCIA = 0.15; // +15% sobre custo × 3 para o valor de referência

/** Preço de um item do catálogo, aplicando a área mínima de 1m² e o pedido mínimo de R$80. */
export function precoItemCatalogo(item: ItemOrcamento, area: number): number {
  if (item.preco == null) return 0; // "sob projeto" — sem preço tabelado
  const bruto = item.tipo_cobranca === "m2" ? Math.max(area, AREA_MINIMA_M2) * item.preco : item.preco;
  return Math.max(bruto, PEDIDO_MINIMO);
}

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

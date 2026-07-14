import type { Material } from "./types";

export interface OrcamentoItem {
  materialId: string;
  quantidade: number; // m² para unidade 'm2', metros para 'metro_linear', unidades para 'unidade'
}

export interface OrcamentoResultado {
  custoMaterial: number;
  valorBase: number;
}

/**
 * Cálculo determinístico de orçamento (plan §7): custo de material somado, depois
 * aplicado % de mão-de-obra e % de margem em cascata. A IA (função separada) só
 * sugere um ajuste em texto por cima deste número — nunca substitui o cálculo.
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

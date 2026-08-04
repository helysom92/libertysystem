"use server";

import { createClient } from "@/lib/supabase/server";
import type { CategoriaPrazo, ModoCalculoItem } from "@/lib/domain/orcamento";

export interface OrcamentoItemInput {
  ordem: number;
  descricao: string;
  categoriaPrazo: CategoriaPrazo;
  modoCalculo: ModoCalculoItem;
  itemOrcamentoId: string | null;
  larguraCm: number | null;
  alturaCm: number | null;
  quantidade: number;
  custoDireto: number | null;
  precoM2Manual: number | null;
  valorFinal: number;
}

export async function createOrcamentoItens(servicoId: string, itens: OrcamentoItemInput[]) {
  if (itens.length === 0) return;
  const supabase = await createClient();
  const { error } = await supabase.from("orcamento_itens").insert(
    itens.map((item) => ({
      servico_id: servicoId,
      ordem: item.ordem,
      descricao: item.descricao,
      categoria_prazo: item.categoriaPrazo,
      modo_calculo: item.modoCalculo,
      item_orcamento_id: item.itemOrcamentoId,
      largura_cm: item.larguraCm,
      altura_cm: item.alturaCm,
      quantidade: item.quantidade,
      custo_direto: item.custoDireto,
      preco_m2_manual: item.precoM2Manual,
      valor_final: item.valorFinal,
    }))
  );
  if (error) throw error;
}

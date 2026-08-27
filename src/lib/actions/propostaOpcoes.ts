"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidateServicoPaths } from "./revalidateServicos";
import type { LinhaOrcamento } from "@/lib/domain/orcamento";
import { requireRole } from "@/lib/domain/permissions";

export interface PropostaOpcaoInput {
  linha: LinhaOrcamento;
  titulo: string;
  descricao: string | null;
  valor: number;
  ordem: number;
}

/** Substitui as até-3 opções da proposta interativa de um serviço (mesmo padrão de
 * replaceOrcamentoItens: apaga e recria, mais simples que diff linha a linha). */
export async function salvarPropostaOpcoes(servicoId: string, opcoes: PropostaOpcaoInput[]) {
  await requireRole("administrador", "secretaria");
  const supabase = await createClient();

  const { error: delErr } = await supabase.from("proposta_opcoes").delete().eq("servico_id", servicoId);
  if (delErr) throw delErr;

  if (opcoes.length > 0) {
    const { error: insErr } = await supabase.from("proposta_opcoes").insert(
      opcoes.map((o) => ({
        servico_id: servicoId,
        linha: o.linha,
        titulo: o.titulo,
        descricao: o.descricao,
        valor: o.valor,
        ordem: o.ordem,
      }))
    );
    if (insErr) throw insErr;
  }

  revalidateServicoPaths();
}

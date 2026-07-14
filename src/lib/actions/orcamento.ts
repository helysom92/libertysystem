"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { fmtBRL } from "@/lib/domain/types";
import { TIPO_LABELS, type ServicoTipo } from "@/lib/domain/flows";

export interface SugestaoIaInput {
  tipo: ServicoTipo;
  descricao: string;
  valorCalculado: number;
}

/**
 * Sugestão de apoio da IA comparando com serviços concluídos parecidos (plan §7) —
 * texto informativo, nunca substitui o valor calculado pela fórmula sozinho.
 */
export async function sugerirValorComIa(input: SugestaoIaInput): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return "Sugestão por IA não configurada ainda (falta a chave ANTHROPIC_API_KEY nas variáveis de ambiente).";
  }

  const supabase = await createClient();
  const { data: similares } = await supabase
    .from("servicos")
    .select("descricao, valor, tipo")
    .eq("tipo", input.tipo)
    .eq("estagio", "Concluído")
    .order("criado_em", { ascending: false })
    .limit(5);

  if (!similares || similares.length === 0) {
    return "Ainda não há serviços concluídos desse tipo para comparar — sem histórico suficiente ainda.";
  }

  const listaServicos = similares
    .map((s) => `- ${s.descricao} (${fmtBRL(s.valor)})`)
    .join("\n");

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: `Você ajuda uma empresa de comunicação visual a revisar orçamentos. Tipo de serviço: ${TIPO_LABELS[input.tipo]}. Descrição do novo serviço: "${input.descricao}". Valor calculado pela fórmula de custo: ${fmtBRL(input.valorCalculado)}.

Serviços concluídos parecidos (mesmo tipo):
${listaServicos}

Em no máximo 3 frases, em português, comente se o valor calculado parece consistente com esses serviços parecidos, e se algo chama atenção (muito abaixo ou muito acima da faixa histórica). Não decida um valor final — apenas comente.`,
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  return textBlock && textBlock.type === "text" ? textBlock.text : "Não foi possível gerar uma sugestão agora.";
}

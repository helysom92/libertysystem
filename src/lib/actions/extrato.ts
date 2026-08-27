"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { conciliarExtrato, type LinhaExtrato, type ConciliacaoResultado } from "@/lib/domain/extrato";
import { monthlySeries, pendenciasDoMes as calcPendenciasDoMes, type PendenciasDoMes } from "@/lib/domain/dashboardMetrics";
import type {
  DespesaFixa,
  DespesaFixaOcorrencia,
  DespesaVariavel,
  DespesaVariavelOcorrencia,
  Lancamento,
} from "@/lib/domain/types";
import { revalidatePath } from "next/cache";

export interface AnaliseExtratoResultado {
  resultado: ConciliacaoResultado;
  totalLinhas: number;
}

function ultimoDiaDoMes(ano: number, mes: number): string {
  const dia = new Date(ano, mes, 0).getDate();
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export async function analisarExtrato(
  storagePath: string,
  ano: number,
  mes: number,
  meuNome: string
): Promise<AnaliseExtratoResultado> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Leitura de extrato por IA não configurada (falta ANTHROPIC_API_KEY).");
  }

  const supabase = await createClient();

  const { data: arquivo, error: downloadErr } = await supabase.storage.from("arquivos").download(storagePath);
  if (downloadErr || !arquivo) throw downloadErr ?? new Error("Não foi possível baixar o extrato enviado.");
  const base64 = Buffer.from(await arquivo.arrayBuffer()).toString("base64");

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 8000,
    messages: [
      {
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
          {
            type: "text",
            text: `Esse é um extrato bancário. Extraia TODAS as movimentações (entradas e saídas) numa lista JSON, sem nenhum texto antes ou depois — só o array.

Formato exato de cada item:
{"data": "AAAA-MM-DD", "descricao": "texto da linha", "valor": 123.45, "tipo": "Receita"}

"tipo" é "Receita" pra dinheiro que entrou e "Despesa" pra dinheiro que saiu. "valor" sempre positivo (sem sinal). Responda só o array JSON, nada mais.`,
          },
        ],
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  const texto = textBlock && textBlock.type === "text" ? textBlock.text : "";
  const jsonMatch = texto.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("A IA não conseguiu ler esse extrato. Tente outro arquivo.");

  let linhas: LinhaExtrato[];
  try {
    linhas = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error("A IA devolveu um formato inválido ao ler o extrato. Tente novamente.");
  }

  const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const fim = ultimoDiaDoMes(ano, mes);
  const { data: lancamentos } = await supabase
    .from("lancamentos")
    .select("*")
    .gte("data", inicio)
    .lte("data", fim);

  const resultado = conciliarExtrato(linhas, (lancamentos as Lancamento[]) ?? [], meuNome);
  return { resultado, totalLinhas: linhas.length };
}

export async function pendenciasDoMes(ano: number, mes: number): Promise<PendenciasDoMes> {
  const supabase = await createClient();
  const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const fim = ultimoDiaDoMes(ano, mes);

  const [
    { data: despesasFixas },
    { data: ocorrenciasFixas },
    { data: despesasVariaveis },
    { data: ocorrenciasVariaveis },
    { data: lancamentosPrevistos },
  ] = await Promise.all([
    supabase.from("despesas_fixas").select("*").eq("ativo", true),
    supabase.from("despesas_fixas_ocorrencias").select("*").eq("ano", ano).eq("mes", mes),
    supabase.from("despesas_variaveis").select("*").eq("ativo", true),
    supabase.from("despesas_variaveis_ocorrencias").select("*").eq("ano", ano).eq("mes", mes),
    supabase.from("lancamentos").select("*").eq("status", "previsto").gte("data", inicio).lte("data", fim),
  ]);

  return calcPendenciasDoMes(
    (despesasFixas as DespesaFixa[]) ?? [],
    (ocorrenciasFixas as DespesaFixaOcorrencia[]) ?? [],
    (despesasVariaveis as DespesaVariavel[]) ?? [],
    (ocorrenciasVariaveis as DespesaVariavelOcorrencia[]) ?? [],
    (lancamentosPrevistos as Lancamento[]) ?? []
  );
}

export interface RetiradaDoMes {
  id: string;
  valor: number;
  data: string;
}

/** Retirada de lucro já registrada nesse mês (se houver) — evita lançar duas vezes por
 * engano ao reabrir a tela de fechamento. */
export async function retiradaDoMes(ano: number, mes: number): Promise<RetiradaDoMes | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lancamentos")
    .select("id, valor, data")
    .eq("categoria", "Retirada de Lucro")
    .gte("data", `${ano}-${String(mes).padStart(2, "0")}-01`)
    .lte("data", ultimoDiaDoMes(ano, mes))
    .maybeSingle();
  return (data as RetiradaDoMes) ?? null;
}

export async function fecharMes(ano: number, mes: number) {
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const { data: lancamentos } = await supabase
    .from("lancamentos")
    .select("*")
    .eq("status", "realizado")
    .gte("data", `${ano}-${String(mes).padStart(2, "0")}-01`)
    .lte("data", ultimoDiaDoMes(ano, mes));

  const [ponto] = monthlySeries((lancamentos as Lancamento[]) ?? [], new Date(ano, mes - 1, 1), 1);
  const entrou = ponto?.sales ?? 0;
  const saiu = ponto?.expenses ?? 0;

  const { error } = await supabase
    .from("fechamentos_mensais")
    .upsert(
      { ano, mes, entrou, saiu, lucro: entrou - saiu, fechado_em: new Date().toISOString(), fechado_por: profile?.id ?? null },
      { onConflict: "ano,mes" }
    );
  if (error) throw error;

  revalidatePath("/gestao");
  return { entrou, saiu, lucro: entrou - saiu };
}

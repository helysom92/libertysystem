"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { conciliarExtrato, type LinhaExtrato, type ConciliacaoResultado } from "@/lib/domain/extrato";
import { pendenciasDoMes as calcPendenciasDoMes, type PendenciasDoMes } from "@/lib/domain/dashboardMetrics";
import {
  excluirPrevistosDeServicoCancelado,
  periodoDoMes,
  recebido,
  despesasPagas,
  resultadoRealizado,
} from "@/lib/domain/financas";
import type {
  DespesaFixa,
  DespesaFixaOcorrencia,
  DespesaVariavel,
  DespesaVariavelOcorrencia,
  Lancamento,
  Servico,
} from "@/lib/domain/types";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/domain/permissions";
import type { AcaoComDado } from "./resultado";

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
): Promise<AcaoComDado<AnaliseExtratoResultado>> {
  await requireRole("administrador");
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, message: "Leitura de extrato por IA não configurada (falta ANTHROPIC_API_KEY)." };
  }

  const supabase = await createClient();

  const { data: arquivo, error: downloadErr } = await supabase.storage.from("arquivos").download(storagePath);
  if (downloadErr || !arquivo) return { ok: false, message: downloadErr?.message ?? "Não foi possível baixar o extrato enviado." };
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
  if (!jsonMatch) return { ok: false, message: "A IA não conseguiu ler esse extrato. Tente outro arquivo." };

  let linhas: LinhaExtrato[];
  try {
    linhas = JSON.parse(jsonMatch[0]);
  } catch {
    return { ok: false, message: "A IA devolveu um formato inválido ao ler o extrato. Tente novamente." };
  }

  const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const fim = ultimoDiaDoMes(ano, mes);
  const { data: lancamentos } = await supabase
    .from("lancamentos")
    .select("*")
    .gte("data", inicio)
    .lte("data", fim);

  const resultado = conciliarExtrato(linhas, (lancamentos as Lancamento[]) ?? [], meuNome);
  return { ok: true, data: { resultado, totalLinhas: linhas.length } };
}

export async function pendenciasDoMes(ano: number, mes: number): Promise<PendenciasDoMes> {
  await requireRole("administrador");
  const supabase = await createClient();
  const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const fim = ultimoDiaDoMes(ano, mes);

  const [
    { data: despesasFixas },
    { data: ocorrenciasFixas },
    { data: despesasVariaveis },
    { data: ocorrenciasVariaveis },
    { data: lancamentosPrevistos },
    { data: servicosCancelados },
  ] = await Promise.all([
    supabase.from("despesas_fixas").select("*").eq("ativo", true),
    supabase.from("despesas_fixas_ocorrencias").select("*").eq("ano", ano).eq("mes", mes),
    supabase.from("despesas_variaveis").select("*").eq("ativo", true),
    supabase.from("despesas_variaveis_ocorrencias").select("*").eq("ano", ano).eq("mes", mes),
    supabase.from("lancamentos").select("*").eq("status", "previsto").gte("data", inicio).lte("data", fim),
    supabase.from("servicos").select("id, financeiro_status").eq("financeiro_status", "Cancelado"),
  ]);

  const lancamentosValidos = excluirPrevistosDeServicoCancelado(
    (lancamentosPrevistos as Lancamento[]) ?? [],
    (servicosCancelados as Pick<Servico, "id" | "financeiro_status">[]) ?? []
  );

  return calcPendenciasDoMes(
    (despesasFixas as DespesaFixa[]) ?? [],
    (ocorrenciasFixas as DespesaFixaOcorrencia[]) ?? [],
    (despesasVariaveis as DespesaVariavel[]) ?? [],
    (ocorrenciasVariaveis as DespesaVariavelOcorrencia[]) ?? [],
    lancamentosValidos
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
  await requireRole("administrador");
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

export interface FechamentoResultado {
  entrou: number;
  saiu: number;
  lucro: number;
}

export async function fecharMes(ano: number, mes: number): Promise<AcaoComDado<FechamentoResultado>> {
  await requireRole("administrador");
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const periodo = periodoDoMes(ano, mes);

  const { data: lancamentosRaw } = await supabase
    .from("lancamentos")
    .select("*")
    .gte("data", periodo.inicio)
    .lte("data", periodo.fim);
  const lancamentos = (lancamentosRaw as Lancamento[]) ?? [];

  // Resultado realizado (Etapa 2): recebido − despesas pagas, dinheiro que já entrou/saiu de
  // verdade. Dinheiro de um serviço cancelado ANTES do cancelamento continua contando aqui —
  // é fato histórico, não é apagado.
  const entrou = recebido(lancamentos, periodo).total;
  const saiu = despesasPagas(lancamentos, periodo).total;
  const lucro = resultadoRealizado(entrou, saiu);

  const { error } = await supabase
    .from("fechamentos_mensais")
    .upsert(
      { ano, mes, entrou, saiu, lucro, fechado_em: new Date().toISOString(), fechado_por: profile?.id ?? null },
      { onConflict: "ano,mes" }
    );
  if (error) return { ok: false, message: error.message };

  revalidatePath("/gestao");
  return { ok: true, data: { entrou, saiu, lucro } };
}

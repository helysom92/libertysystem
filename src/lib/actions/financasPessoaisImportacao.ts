"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireHelysom } from "@/lib/domain/permissions";
import type { LinhaExtratoPessoal } from "@/lib/domain/extratoPessoal";
import type { AcaoComDado } from "./resultado";
import { ehDuplicataMovimentoPessoal } from "@/lib/domain/financasPessoais";

// NUNCA `export type { X }` num arquivo "use server" — o scanner de exports do Next.js 16/
// Turbopack não reconhece isso como type-only aqui e quebra TODA action do arquivo em produção
// (achado real, ver financasPessoais.ts). Quem precisar do tipo importa direto de "./resultado".

function revalidateImportacaoPaths() {
  revalidatePath("/financas-pessoais");
  revalidatePath("/financas-pessoais/visao-geral");
  revalidatePath("/financas-pessoais/receitas-despesas");
  revalidatePath("/financas-pessoais/contas");
}

/** Lê um extrato (PDF) já enviado pro bucket privado `financas-pessoais`, extrai as linhas via
 * IA e apaga o arquivo em seguida — não precisa reter o PDF do banco depois de lido. Nunca cria
 * receita/despesa sozinha: só devolve a lista pra revisão manual (Bloco E: "prévia + confirmação
 * manual antes de salvar, nunca automática"). */
export async function analisarExtratoPessoal(storagePath: string): Promise<AcaoComDado<LinhaExtratoPessoal[]>> {
  await requireHelysom();
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, message: "Leitura de extrato por IA não configurada (falta ANTHROPIC_API_KEY)." };
  }
  const supabase = await createClient();

  const { data: arquivo, error: downloadErr } = await supabase.storage.from("financas-pessoais").download(storagePath);
  if (downloadErr || !arquivo) return { ok: false, message: downloadErr?.message ?? "Não foi possível baixar o arquivo enviado." };
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
            text: `Esse é um extrato bancário ou financeiro pessoal. Extraia TODAS as movimentações (entradas e saídas) numa lista JSON, sem nenhum texto antes ou depois — só o array.

Formato exato de cada item:
{"data": "AAAA-MM-DD", "descricao": "texto da linha", "valor": 123.45, "tipo": "Receita"}

"tipo" é "Receita" pra dinheiro que entrou e "Despesa" pra dinheiro que saiu. "valor" sempre positivo (sem sinal). Responda só o array JSON, nada mais.`,
          },
        ],
      },
    ],
  });

  await supabase.storage.from("financas-pessoais").remove([storagePath]);

  const textBlock = message.content.find((b) => b.type === "text");
  const texto = textBlock && textBlock.type === "text" ? textBlock.text : "";
  const jsonMatch = texto.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return { ok: false, message: "A IA não conseguiu ler esse arquivo. Tente outro extrato." };

  let linhas: LinhaExtratoPessoal[];
  try {
    linhas = JSON.parse(jsonMatch[0]);
  } catch {
    return { ok: false, message: "A IA devolveu um formato inválido ao ler o extrato. Tente novamente." };
  }

  return { ok: true, data: linhas };
}

export interface ImportarMovimentoInput {
  descricao: string;
  categoria: string | null;
  valor: number;
  data: string;
  contaId: string;
  /** Etapa 7.1 — usuário já confirmou que quer registrar mesmo parecendo duplicata. */
  confirmarDuplicata?: boolean;
}

/** Resultado de false pode vir com `duplicataPossivel: true` — nesse caso não é um erro de
 * verdade, é um pedido de confirmação (Etapa 7.1: nunca bloquear um movimento genuinamente
 * repetido, só avisar e deixar o usuário decidir). */
export type ResultadoImportacao = { ok: true } | { ok: false; message: string; duplicataPossivel?: boolean };

/**
 * Etapa 7.1 — proteção contra importação duplicada: mesma conta + mesma data + valor
 * (±1 centavo) + descrição igual normalizada já lançada = provável duplicata do extrato
 * (critério puro em `ehDuplicataMovimentoPessoal`, financasPessoais.ts). Não é um hash guardado
 * no banco (schema não muda) — é a mesma verificação, feita na hora, contra o que já existe
 * pra essa conta/data. Escopo estreito (uma conta, um dia) pra ficar barato e não pegar
 * lançamento antigo não relacionado.
 */
async function existeMovimentoPessoalDuplicado(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tabela: "receitas_pessoais" | "despesas_pessoais",
  colunaConta: "conta_destino_id" | "conta_id",
  colunaData: "data_prevista" | "vencimento",
  ownerId: string,
  contaId: string,
  data: string,
  valor: number,
  descricao: string
): Promise<boolean> {
  const { data: existentes } = await supabase
    .from(tabela)
    .select("valor_previsto, descricao")
    .eq("owner_id", ownerId)
    .eq(colunaConta, contaId)
    .eq(colunaData, data);
  return (existentes ?? []).some((e) =>
    ehDuplicataMovimentoPessoal({ valor: e.valor_previsto, descricao: e.descricao }, { valor, descricao })
  );
}

/** Cria a receita já como recebida (o dinheiro já entrou, é fato do extrato) — insere e
 * registra o recebimento total na sequência, reaproveitando a RPC atômica que já existe
 * (`registrar_recebimento_pessoal`, migration 0039). Nenhuma tabela/RPC nova pro Bloco E. */
export async function importarReceitaRealizada(input: ImportarMovimentoInput): Promise<ResultadoImportacao> {
  const profile = await requireHelysom();
  const supabase = await createClient();

  if (!input.confirmarDuplicata) {
    const duplicada = await existeMovimentoPessoalDuplicado(
      supabase,
      "receitas_pessoais",
      "conta_destino_id",
      "data_prevista",
      profile.id,
      input.contaId,
      input.data,
      input.valor,
      input.descricao
    );
    if (duplicada) {
      return {
        ok: false,
        message: "Já existe uma receita igual (mesma conta, data, valor e descrição) — pode ser duplicata do extrato.",
        duplicataPossivel: true,
      };
    }
  }

  const { data: receita, error: errInsert } = await supabase
    .from("receitas_pessoais")
    .insert({
      owner_id: profile.id,
      descricao: input.descricao,
      categoria: input.categoria,
      valor_previsto: input.valor,
      conta_destino_id: input.contaId,
      data_prevista: input.data,
      recorrencia: "unica",
    })
    .select("id")
    .single();
  if (errInsert || !receita) return { ok: false, message: errInsert?.message ?? "Não foi possível criar a receita." };

  const { data, error } = await supabase.rpc("registrar_recebimento_pessoal", {
    p_receita_id: receita.id,
    p_valor: input.valor,
    p_data: input.data,
    p_conta_destino_id: input.contaId,
  });
  if (error) return { ok: false, message: error.message };
  const resultado = data as { ok: boolean; reason?: string };
  if (!resultado.ok) return { ok: false, message: resultado.reason ?? "Receita criada, mas o recebimento não pôde ser registrado." };

  revalidateImportacaoPaths();
  return { ok: true };
}

/** Espelha `importarReceitaRealizada` pro lado da despesa. */
export async function importarDespesaRealizada(input: ImportarMovimentoInput): Promise<ResultadoImportacao> {
  const profile = await requireHelysom();
  const supabase = await createClient();

  if (!input.confirmarDuplicata) {
    const duplicada = await existeMovimentoPessoalDuplicado(
      supabase,
      "despesas_pessoais",
      "conta_id",
      "vencimento",
      profile.id,
      input.contaId,
      input.data,
      input.valor,
      input.descricao
    );
    if (duplicada) {
      return {
        ok: false,
        message: "Já existe uma despesa igual (mesma conta, data, valor e descrição) — pode ser duplicata do extrato.",
        duplicataPossivel: true,
      };
    }
  }

  const { data: despesa, error: errInsert } = await supabase
    .from("despesas_pessoais")
    .insert({
      owner_id: profile.id,
      descricao: input.descricao,
      categoria: input.categoria,
      valor_previsto: input.valor,
      conta_id: input.contaId,
      vencimento: input.data,
      recorrencia: "unica",
    })
    .select("id")
    .single();
  if (errInsert || !despesa) return { ok: false, message: errInsert?.message ?? "Não foi possível criar a despesa." };

  const { data, error } = await supabase.rpc("registrar_pagamento_pessoal", {
    p_despesa_id: despesa.id,
    p_valor: input.valor,
    p_data: input.data,
    p_conta_id: input.contaId,
  });
  if (error) return { ok: false, message: error.message };
  const resultado = data as { ok: boolean; reason?: string };
  if (!resultado.ok) return { ok: false, message: resultado.reason ?? "Despesa criada, mas o pagamento não pôde ser registrado." };

  revalidateImportacaoPaths();
  return { ok: true };
}

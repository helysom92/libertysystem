import { createServiceClient } from "@/lib/supabase/service";
import {
  ativarInclusaoDeSaques,
  baixarRelatorio,
  garantirConfiguracao,
  listarRelatorios,
  solicitarRelatorio,
} from "@/lib/mercadopago/relatorio";
import { interpretarRelatorio, type MovimentoRelatorio } from "@/lib/domain/relatorioMercadoPago";

// Esperar o relatório ficar pronto leva alguns segundos — o limite padrão (10s) não basta.
export const maxDuration = 60;

interface MovimentoMercadoPago {
  mpId: string;
  data: string; // "AAAA-MM-DD"
  valor: number; // sempre positivo
  tipo: "Receita" | "Despesa";
  descricao: string;
  contraparte: string | null;
  tipoBruto: string;
  pagador: Record<string, unknown>;
}

interface PagamentoMercadoPago {
  id: number | string;
  status: string;
  date_approved?: string;
  date_created?: string;
  transaction_amount?: number;
  operation_type?: string;
  description?: string | null;
  payer?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    identification?: { type?: string | null; number?: string | null } | null;
  };
  point_of_interaction?: {
    transaction_data?: { bank_info?: { payer?: { long_name?: string | null } } };
  };
}

/**
 * Tudo que o Mercado Pago diz sobre quem pagou. `nome` é o da PESSOA/EMPRESA (o destaque na
 * tela); o `long_name` do Pix é o nome do BANCO dela (Sicredi etc.) e fica só como informação
 * secundária. O nome da pessoa costuma vir mascarado ("XXXXXXXXXXX") — isso não é nome.
 * `bruto` guarda o objeto original do pagador pra podermos ver o que a conta realmente recebe.
 */
function infoDoPagador(p: PagamentoMercadoPago): Record<string, unknown> {
  const nome = [textoUtil(p.payer?.first_name), textoUtil(p.payer?.last_name)].filter(Boolean).join(" ").trim();
  return {
    nome: nome || null,
    banco: textoUtil(p.point_of_interaction?.transaction_data?.bank_info?.payer?.long_name),
    documento: textoUtil(p.payer?.identification?.number),
    tipoDocumento: p.payer?.identification?.type ?? null,
    email: textoUtil(p.payer?.email),
    bruto: p.payer ?? null,
  };
}

/** Texto genérico/mascarado = vazio, curtinho ou um caractere repetido ("XXXXXXXXXXX"). */
function textoUtil(texto: string | null | undefined): string | null {
  const t = texto?.trim();
  if (!t || t.length < 3 || /^(.)\1*$/.test(t)) return null;
  return t;
}

/**
 * Busca os pagamentos recentes na conta Mercado Pago via `/v1/payments/search` — API de
 * Payments estável e documentada, diferente do produto de relatório agendado ("extrato de
 * conta"/settlement report) que exige configurar e esperar um arquivo ser gerado.
 *
 * CONFIRMAR NO PRIMEIRO TESTE REAL (plano original dessa etapa): os nomes de campo abaixo
 * (`date_approved`, `transaction_amount`, `operation_type`) contra a documentação oficial
 * logada e/ou uma conta de sandbox antes de confiar nisso em produção — não foi possível
 * verificar o contrato exato ao planejar essa etapa (a doc pública não carregou o conteúdo
 * técnico nas duas tentativas feitas). Se o formato real vier diferente, só este arquivo
 * precisa mudar — o resto da sincronização (tabela, rota, Conferência) não depende disso.
 */
async function buscarMovimentosMercadoPago(diasAtras: number): Promise<MovimentoMercadoPago[]> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) return [];

  const fim = new Date();
  const inicio = new Date(fim.getTime() - diasAtras * 86_400_000);
  const params = new URLSearchParams({
    sort: "date_created",
    criteria: "desc",
    range: "date_created",
    begin_date: inicio.toISOString(),
    end_date: fim.toISOString(),
  });

  const resposta = await fetch(`https://api.mercadopago.com/v1/payments/search?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resposta.ok) {
    throw new Error(`Mercado Pago devolveu ${resposta.status} ao buscar pagamentos.`);
  }
  const corpo = await resposta.json();
  const resultados: PagamentoMercadoPago[] = corpo.results ?? [];

  return resultados
    .filter((p) => p.status === "approved")
    .map((p) => {
      const valorBruto = Number(p.transaction_amount ?? 0);
      const tipo: "Receita" | "Despesa" = valorBruto < 0 ? "Despesa" : "Receita";
      const pagador = infoDoPagador(p);
      const nome = pagador.nome as string | null;
      const partes = [nome, textoUtil(p.description)].filter(
        (parte, i, todas): parte is string => !!parte && todas.indexOf(parte) === i
      );
      // Sem nome nem descrição: usa o e-mail ou um título genérico. O banco NUNCA entra aqui —
      // este texto alimenta regras e o vínculo com cliente, e "Sicredi" casaria com qualquer um.
      // O banco fica em `pagador.banco`, mostrado só como detalhe.
      const alternativa = (pagador.email as string | null) ?? (tipo === "Receita" ? "Pix recebido" : "Pagamento Mercado Pago");
      return {
        mpId: String(p.id),
        data: (p.date_approved ?? p.date_created ?? "").slice(0, 10),
        valor: Math.abs(valorBruto),
        tipo,
        descricao: partes.length > 0 ? partes.join(" — ") : alternativa,
        contraparte: nome,
        tipoBruto: p.operation_type ?? "",
        pagador,
      };
    })
    .filter((m) => m.data.length === 10);
}

type Supabase = ReturnType<typeof createServiceClient>;

const pausa = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Entradas: pagamentos recebidos. Idempotente — o cron repete a janela dos últimos dias, então
 * o mesmo mp_id volta; no conflito só atualiza nome/descrição (melhores), nunca mexe em
 * conciliado/lancamento_id/ignorado_em, que são decisões suas na fila. */
async function sincronizarEntradas(supabase: Supabase): Promise<number> {
  const movimentos = await buscarMovimentosMercadoPago(4);
  if (movimentos.length === 0) return 0;
  const linhas = movimentos.map((m) => ({
    mp_id: m.mpId,
    data: m.data,
    valor: m.valor,
    tipo: m.tipo,
    descricao: m.descricao,
    contraparte: m.contraparte,
    tipo_mp_bruto: m.tipoBruto,
    pagador: m.pagador,
  }));
  let { data, error } = await supabase
    .from("mercadopago_movimentos")
    .upsert(linhas, { onConflict: "mp_id" })
    .select("mp_id");
  // Se a coluna `pagador` ainda não existir (migration pendente), grava sem ela em vez de parar.
  if (error && /pagador/i.test(error.message)) {
    ({ data, error } = await supabase
      .from("mercadopago_movimentos")
      .upsert(
        linhas.map((linha) => {
          const semPagador: Record<string, unknown> = { ...linha };
          delete semPagador.pagador;
          return semPagador;
        }),
        { onConflict: "mp_id" }
      )
      .select("mp_id"));
  }
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

/** Saídas: relatório "Dinheiro em conta". É assíncrono — pedimos a geração, esperamos um pouco
 * e importamos os 2 mais recentes (o que não ficar pronto agora entra na próxima rodada).
 * Importar o mesmo arquivo de novo é inofensivo: `ignoreDuplicates` por mp_id. */
async function sincronizarSaidas(supabase: Supabase, token: string) {
  const { criada } = await garantirConfiguracao(token);

  const antes = Date.now();
  await solicitarRelatorio(token, 15);
  for (let i = 0; i < 6; i++) {
    await pausa(5000);
    const lista = await listarRelatorios(token);
    if (lista.some((r) => Date.parse(r.date_created) >= antes - 60_000)) break;
  }

  const recentes = (await listarRelatorios(token))
    .sort((a, b) => Date.parse(b.date_created) - Date.parse(a.date_created))
    .slice(0, 2);

  const movimentos: MovimentoRelatorio[] = [];
  const contagemPorTipo: Record<string, number> = {};
  let colunasAusentes: string[] = [];
  const arquivos: { nome: string; criadoPor: string | null; resultado: string }[] = [];
  for (const r of recentes) {
    try {
      const resultado = interpretarRelatorio(await baixarRelatorio(token, r.file_name));
      movimentos.push(...resultado.movimentos);
      for (const [tipo, n] of Object.entries(resultado.contagemPorTipo)) {
        contagemPorTipo[tipo] = (contagemPorTipo[tipo] ?? 0) + n;
      }
      if (resultado.colunasAusentes.length > 0) colunasAusentes = resultado.colunasAusentes;
      arquivos.push({ nome: r.file_name, criadoPor: r.created_from ?? null, resultado: "ok" });
    } catch (err) {
      arquivos.push({
        nome: r.file_name,
        criadoPor: r.created_from ?? null,
        resultado: err instanceof Error ? err.message : "falhou",
      });
    }
  }

  let novos = 0;
  if (movimentos.length > 0) {
    const unicos = [...new Map(movimentos.map((m) => [m.mpId, m])).values()];
    const { data, error } = await supabase
      .from("mercadopago_movimentos")
      .upsert(
        unicos.map((m) => ({
          mp_id: m.mpId,
          data: m.data,
          valor: m.valor,
          tipo: m.tipo,
          descricao: m.descricao,
          contraparte: m.contraparte,
          tipo_mp_bruto: m.tipoBruto,
        })),
        { onConflict: "mp_id", ignoreDuplicates: true }
      )
      .select("mp_id");
    if (error) throw new Error(error.message);
    novos = data?.length ?? 0;
  }

  return { configCriada: criada, arquivos, saidasNovas: novos, contagemPorTipo, colunasAusentes };
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createServiceClient();
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  const resposta: Record<string, unknown> = {};

  // Cada parte falha sozinha: um erro no relatório de saídas nunca derruba as entradas.
  try {
    resposta.processados = await sincronizarEntradas(supabase);
  } catch (err) {
    resposta.erroEntradas = err instanceof Error ? err.message : "Falha ao buscar entradas no Mercado Pago";
  }

  if (token) {
    // Passo único, autorizado pelo Helysom: ligar `include_withdraw` na configuração existente.
    if (new URL(request.url).searchParams.get("ativarSaques") === "1") {
      try {
        resposta.ativarSaques = await ativarInclusaoDeSaques(token);
      } catch (err) {
        resposta.erroAtivarSaques = err instanceof Error ? err.message : "Falha ao atualizar a configuração";
      }
    }
    try {
      resposta.saidas = await sincronizarSaidas(supabase, token);
    } catch (err) {
      resposta.erroSaidas = err instanceof Error ? err.message : "Falha no relatório de saídas";
    }
  }

  return Response.json(resposta, { status: resposta.erroEntradas && !resposta.saidas ? 502 : 200 });
}

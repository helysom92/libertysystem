import { createServiceClient } from "@/lib/supabase/service";

interface MovimentoMercadoPago {
  mpId: string;
  data: string; // "AAAA-MM-DD"
  valor: number; // sempre positivo
  tipo: "Receita" | "Despesa";
  descricao: string;
  contraparte: string | null;
  tipoBruto: string;
}

interface PagamentoMercadoPago {
  id: number | string;
  status: string;
  date_approved?: string;
  date_created?: string;
  transaction_amount?: number;
  operation_type?: string;
  description?: string | null;
  payer?: { first_name?: string | null; last_name?: string | null; email?: string | null };
  point_of_interaction?: {
    transaction_data?: { bank_info?: { payer?: { long_name?: string | null } } };
  };
}

/** Nome de quem pagou: nome/sobrenome, senão e-mail. Só se não houver nada disso cai no
 * `long_name` do Pix — que, na prática, costuma ser o nome do BANCO do pagador (Sicredi etc.),
 * não da pessoa, e por isso nunca deve ser o preferido pra casar regras. */
function nomeDoPagador(p: PagamentoMercadoPago): string | null {
  const nome = [p.payer?.first_name, p.payer?.last_name].filter(Boolean).join(" ").trim();
  if (nome) return nome;
  const email = p.payer?.email?.trim();
  if (email) return email;
  return p.point_of_interaction?.transaction_data?.bank_info?.payer?.long_name?.trim() || null;
}

/** Descrição genérica = vazia, curtinha ou um caractere repetido ("XXXXXXXXXXX"). */
function descricaoUtil(texto: string | null | undefined): string | null {
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
      const contraparte = nomeDoPagador(p);
      const partes = [contraparte, descricaoUtil(p.description)].filter(
        (parte, i, todas): parte is string => !!parte && todas.indexOf(parte) === i
      );
      return {
        mpId: String(p.id),
        data: (p.date_approved ?? p.date_created ?? "").slice(0, 10),
        valor: Math.abs(valorBruto),
        tipo,
        descricao: partes.length > 0 ? partes.join(" — ") : "Pagamento Mercado Pago",
        contraparte,
        tipoBruto: p.operation_type ?? "",
      };
    })
    .filter((m) => m.data.length === 10);
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  let movimentos: MovimentoMercadoPago[];
  try {
    movimentos = await buscarMovimentosMercadoPago(4);
  } catch (err) {
    return Response.json({ erro: err instanceof Error ? err.message : "Falha ao buscar no Mercado Pago" }, { status: 502 });
  }

  if (movimentos.length === 0) {
    return Response.json({ processados: 0 });
  }

  const supabase = createServiceClient();
  const linhas = movimentos.map((m) => ({
    mp_id: m.mpId,
    data: m.data,
    valor: m.valor,
    tipo: m.tipo,
    descricao: m.descricao,
    contraparte: m.contraparte,
    tipo_mp_bruto: m.tipoBruto,
  }));

  // Idempotente: o cron repete a janela dos últimos dias, então o mesmo mp_id volta. No
  // conflito só atualiza as colunas enviadas acima (nome/descrição melhores) — nunca mexe em
  // conciliado/lancamento_id/ignorado_em, que são decisões suas na fila.
  const { data: processados, error } = await supabase
    .from("mercadopago_movimentos")
    .upsert(linhas, { onConflict: "mp_id" })
    .select("mp_id");

  if (error) {
    return Response.json({ erro: error.message }, { status: 500 });
  }

  return Response.json({ processados: processados?.length ?? 0 });
}

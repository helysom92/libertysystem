const BASE = "https://api.mercadopago.com/v1/account/settlement_report";

export interface RelatorioListado {
  id: number;
  file_name: string;
  created_from?: string;
  date_created: string;
}

function cabecalhos(token: string, json = false): HeadersInit {
  return { Authorization: `Bearer ${token}`, ...(json ? { "Content-Type": "application/json" } : {}) };
}

async function erroDe(r: Response, acao: string): Promise<Error> {
  const corpo = (await r.text().catch(() => "")).slice(0, 200);
  return new Error(`Relatório do Mercado Pago (${acao}) devolveu ${r.status}${corpo ? `: ${corpo}` : ""}`);
}

/**
 * A configuração do relatório só pode ser criada UMA vez por conta. Se já existir (a sua, do
 * painel ou de antes), não mexemos nela — só criamos quando não há nenhuma. As colunas pedidas
 * são as do glossário oficial; `include_withdraw` é o que faz as saídas aparecerem.
 */
export async function garantirConfiguracao(token: string): Promise<{ criada: boolean }> {
  const atual = await fetch(`${BASE}/config`, { headers: cabecalhos(token) });
  if (atual.ok) return { criada: false };

  const criar = await fetch(`${BASE}/config`, {
    method: "POST",
    headers: cabecalhos(token, true),
    body: JSON.stringify({
      file_name_prefix: "liberty-extrato",
      columns: [
        "SOURCE_ID",
        "TRANSACTION_TYPE",
        "TRANSACTION_DATE",
        "SETTLEMENT_DATE",
        "SETTLEMENT_NET_AMOUNT",
        "TRANSACTION_AMOUNT",
        "DESCRIPTION",
        "PAYMENT_METHOD",
        "PAYMENT_METHOD_TYPE",
        "EXTERNAL_REFERENCE",
        "POI_BANK_NAME",
      ].map((key) => ({ key })),
      frequency: { hour: 0, type: "monthly", value: 1 },
      separator: ";",
      report_translation: "en",
      header_language: "en",
      scheduled: false,
      include_withdraw: true,
    }),
  });
  if (criar.status === 409) return { criada: false };
  if (!criar.ok) throw await erroDe(criar, "criar configuração");
  return { criada: true };
}

/**
 * Liga `include_withdraw` na configuração que já existe, preservando todo o resto: lê a
 * configuração atual e devolve os mesmos campos no PUT (a doc não diz se o PUT substitui tudo).
 * Chamado só sob demanda (`?ativarSaques=1` na rota), nunca no cron diário.
 */
export async function ativarInclusaoDeSaques(token: string): Promise<{ camposLidos: string[]; camposEnviados: string[] }> {
  const lida = await fetch(`${BASE}/config`, { headers: cabecalhos(token) });
  if (!lida.ok) throw await erroDe(lida, "ler configuração");
  const atual = (await lida.json()) as Record<string, unknown>;

  const preservar = [
    "columns",
    "file_name_prefix",
    "frequency",
    "separator",
    "display_timezone",
    "report_translation",
    "header_language",
    "scheduled",
    "refund_detailed",
    "shipping_detail",
    "coupon_detailed",
    "show_chargeback_cancel",
    "show_fee_prevision",
  ];
  const corpo: Record<string, unknown> = {};
  for (const campo of preservar) {
    if (atual[campo] !== undefined && atual[campo] !== null) corpo[campo] = atual[campo];
  }
  corpo.include_withdraw = true;

  const r = await fetch(`${BASE}/config`, { method: "PUT", headers: cabecalhos(token, true), body: JSON.stringify(corpo) });
  if (!r.ok) throw await erroDe(r, "atualizar configuração");
  return { camposLidos: Object.keys(atual), camposEnviados: Object.keys(corpo) };
}

function utcSemMilissegundos(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Pede a geração (assíncrona) do relatório dos últimos `dias` dias. Devolve 202 + tarefa. */
export async function solicitarRelatorio(token: string, dias: number): Promise<void> {
  const fim = new Date();
  const inicio = new Date(fim.getTime() - dias * 86_400_000);
  const r = await fetch(BASE, {
    method: "POST",
    headers: cabecalhos(token, true),
    body: JSON.stringify({ begin_date: utcSemMilissegundos(inicio), end_date: utcSemMilissegundos(fim) }),
  });
  if (!r.ok) throw await erroDe(r, "solicitar");
}

export async function listarRelatorios(token: string): Promise<RelatorioListado[]> {
  const r = await fetch(`${BASE}/list`, { headers: cabecalhos(token) });
  if (!r.ok) throw await erroDe(r, "listar");
  const corpo = await r.json();
  return Array.isArray(corpo) ? (corpo as RelatorioListado[]) : [];
}

export async function baixarRelatorio(token: string, fileName: string): Promise<string> {
  const url = `${BASE}/${encodeURIComponent(fileName)}`;
  let r = await fetch(url, { headers: cabecalhos(token) });
  // A documentação mostra as duas formas de enviar o token (header e `access_token` na URL).
  if (r.status === 403 || r.status === 401) {
    r = await fetch(`${url}?access_token=${encodeURIComponent(token)}`);
  }
  if (!r.ok) throw await erroDe(r, "baixar");
  return r.text();
}

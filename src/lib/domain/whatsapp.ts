import { displayNumero, fmtBRL, type Servico } from "./types";

/**
 * Monta um link `whatsapp://` — abre o WhatsApp Desktop/PWA instalado no computador direto,
 * em vez de abrir o WhatsApp Web numa aba do navegador (`wa.me`/`web.whatsapp.com`).
 * Sem número, cai no seletor de contato do próprio app.
 */
export function whatsappAppUrl(phone: string | null | undefined, text?: string): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  const params = new URLSearchParams();
  if (digits) params.set("phone", `55${digits}`);
  if (text) params.set("text", text);
  const query = params.toString();
  return `whatsapp://send${query ? `?${query}` : ""}`;
}

export function buildWhatsappText(servico: Servico): string {
  const cabecalho = `*${displayNumero(servico)} - ${servico.descricao}*`;
  return [
    cabecalho,
    `Cliente: ${servico.cliente}`,
    `Valor: ${fmtBRL(servico.valor)}`,
    `Prazo: ${servico.prazo ?? "a definir"}`,
    `Status Financeiro: ${servico.financeiro_status}`,
    `Etapa atual: ${servico.estagio}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Abre o WhatsApp instalado com o resumo do serviço/orçamento pré-preenchido; copia o mesmo texto pro clipboard. */
export async function exportarWhatsapp(servico: Servico, clientePhone?: string | null) {
  const texto = buildWhatsappText(servico);
  try {
    await navigator.clipboard.writeText(texto);
  } catch {
    // best-effort, matches prototype's swallowed clipboard errors
  }
  window.open(whatsappAppUrl(clientePhone, texto), "_blank");
}

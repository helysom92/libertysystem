import { fmtBRL, type Servico } from "./types";

export function buildWhatsappText(servico: Servico): string {
  return [
    `*${servico.numero} - ${servico.descricao}*`,
    `Cliente: ${servico.cliente}`,
    `Valor: ${fmtBRL(servico.valor)}`,
    `Prazo: ${servico.prazo ?? "a definir"}`,
    `Status Financeiro: ${servico.financeiro_status}`,
    `Etapa atual: ${servico.estagio}`,
  ].join("\n");
}

/** Opens wa.me with the serviço summary pre-filled; copies the same text to the clipboard. */
export async function exportarWhatsapp(servico: Servico, clientePhone?: string | null) {
  const texto = buildWhatsappText(servico);
  try {
    await navigator.clipboard.writeText(texto);
  } catch {
    // best-effort, matches prototype's swallowed clipboard errors
  }
  const digits = (clientePhone ?? "").replace(/\D/g, "");
  const url = `https://wa.me/55${digits}?text=${encodeURIComponent(texto)}`;
  window.open(url, "_blank");
}

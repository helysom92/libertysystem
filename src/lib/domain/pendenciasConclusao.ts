import { exigeMedida } from "./flows";
import type { ServicoDetail } from "./types";

export interface PendenciaConclusao {
  texto: string;
}

/**
 * Só o que falta OPERACIONALMENTE pra concluir a OS — nunca financeiro (saldo a receber
 * continua cobrado normalmente depois de concluído, não é uma pendência de conclusão).
 * Espelha exatamente o único requisito real que `move_card_para_coluna` verifica hoje
 * (entrega_confirmada) mais os sinais que a Central do Serviço já coleta (checklist, medidas
 * quando o tipo exige, fotos) — nenhum desses é uma trava no banco, é só visibilidade.
 */
export function pendenciasParaConclusao(detail: ServicoDetail): PendenciaConclusao[] {
  const { servico, checklist, medidas, fotos } = detail;
  const pendencias: PendenciaConclusao[] = [];

  if (servico.concluido) return pendencias;

  const checklistPendente = checklist.filter((item) => !item.done);
  if (checklist.length > 0 && checklistPendente.length > 0) {
    for (const item of checklistPendente) {
      pendencias.push({ texto: `Checklist: ${item.texto}` });
    }
  }

  if (exigeMedida(servico.tipo) && medidas.length === 0) {
    pendencias.push({ texto: "Nenhuma medida registrada" });
  }

  if (fotos.length === 0) {
    pendencias.push({ texto: "Nenhuma foto registrada" });
  }

  if (!servico.entrega_confirmada) {
    pendencias.push({ texto: "Entrega ainda não confirmada" });
  }

  return pendencias;
}

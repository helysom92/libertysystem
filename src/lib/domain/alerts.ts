import { daysSince, daysUntil, displayNumero, type Comprovante, type IaAlert, type Servico } from "./types";

const COLOR_RED = "#E07A7A";
const COLOR_AMBER = "#E0A64E";
const COLOR_NEUTRAL = "rgba(244,242,236,0.5)";
const COLOR_GOLD = "#C9A24B";

/**
 * Ported 1:1 from the prototype's computeIaAlerts (Sistema Liberty.dc.html lines 1089-1107).
 * A single serviço can produce multiple alerts simultaneously — not deduplicated/prioritized.
 */
export function computeIaAlerts(servicos: Servico[], comprovantes: Comprovante[]): IaAlert[] {
  const alerts: IaAlert[] = [];

  for (const s of servicos) {
    if (s.concluido) continue;

    const diasParado = daysSince(s.criado_em);
    if (diasParado > 10) {
      alerts.push({
        texto: `${displayNumero(s)} (${s.cliente}) parado há ${diasParado} dias`,
        color: COLOR_RED,
        servicoId: s.id,
        servicoNumero: s.numero,
      });
    }

    const dias = daysUntil(s.prazo);
    if (dias !== null && dias <= 0) {
      alerts.push({
        texto: `${displayNumero(s)} (${s.cliente}) — prazo ${dias === 0 ? "é hoje" : "venceu"}`,
        color: COLOR_RED,
        servicoId: s.id,
        servicoNumero: s.numero,
      });
    } else if (dias !== null && dias <= 3) {
      alerts.push({
        texto: `${displayNumero(s)} (${s.cliente}) — prazo vencendo em ${dias}d`,
        color: COLOR_AMBER,
        servicoId: s.id,
        servicoNumero: s.numero,
      });
    }

    if (!s.responsavel) {
      alerts.push({
        texto: `${displayNumero(s)} (${s.cliente}) sem responsável definido`,
        color: COLOR_NEUTRAL,
        servicoId: s.id,
        servicoNumero: s.numero,
      });
    }

    if (!s.proxima_acao_texto) {
      alerts.push({
        texto: `${displayNumero(s)} (${s.cliente}) sem próxima ação definida`,
        color: COLOR_NEUTRAL,
        servicoId: s.id,
        servicoNumero: s.numero,
      });
    }

    if (s.numero != null && s.valor_pago < s.valor) {
      alerts.push({
        texto: `${displayNumero(s)} (${s.cliente}) com saldo pendente`,
        color: COLOR_GOLD,
        servicoId: s.id,
        servicoNumero: s.numero,
      });
    }

    if (s.entrega_confirmada && !s.concluido) {
      alerts.push({
        texto: `${displayNumero(s)} (${s.cliente}) entregue e não encerrado`,
        color: COLOR_AMBER,
        servicoId: s.id,
        servicoNumero: s.numero,
      });
    }
  }

  for (const c of comprovantes) {
    if (c.status === "pendente") {
      alerts.push({
        texto: `Comprovante de ${c.valor.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })} (${c.banco}) aguardando confirmação`,
        color: COLOR_GOLD,
        servicoId: null,
        servicoNumero: null,
      });
    }
  }

  return alerts;
}

export function alertsForServico(alerts: IaAlert[], servicoId: string): IaAlert[] {
  return alerts.filter((a) => a.servicoId === servicoId);
}

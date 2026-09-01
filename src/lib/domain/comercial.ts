import { yearMonthKeyTz } from "./dates";
import { vendasAprovadas, type PeriodoFiltro } from "./financas";
import type { Servico } from "./types";

export interface RegistroComercial {
  id: string;
  descricao: string;
  valor: number;
  data: string;
}

export interface IndicadorComercial {
  total: number;
  quantidade: number;
  registros: RegistroComercial[];
}

function chaveDoPeriodo(periodo: PeriodoFiltro): string {
  return `${periodo.ano}-${String(periodo.mes).padStart(2, "0")}`;
}

function addDaysISO(dataISO: string, dias: number): string {
  const d = new Date(dataISO + "T00:00:00");
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Uma oportunidade (orçamento) ainda está "viva" no funil: nunca virou OS e nunca foi
 * marcada como perdida. Uma vez aprovada ou perdida, sai do funil comercial pra sempre —
 * mesmo se cancelada depois de aprovada, isso é papel do Financeiro (financeiro_status), não
 * do CRM. */
function oportunidadeAberta(s: Servico): boolean {
  return s.numero == null && s.perdido_em == null;
}

/** Todo orçamento que entrou no funil dentro do mês — independente do desfecho depois. Mês
 * pela data de criação, não de aprovação (essa já é `vendasAprovadas`, financas.ts). */
export function orcamentosDoMes(servicos: Servico[], periodo: PeriodoFiltro): IndicadorComercial {
  const chave = chaveDoPeriodo(periodo);
  const registros: RegistroComercial[] = [];
  for (const s of servicos) {
    if (yearMonthKeyTz(s.criado_em, periodo.timezone) !== chave) continue;
    registros.push({ id: s.id, descricao: `${s.cliente} — ${s.descricao}`, valor: s.valor, data: s.criado_em });
  }
  return { total: registros.reduce((sum, r) => sum + r.valor, 0), quantidade: registros.length, registros };
}

/** Propostas enviadas no mês (link de proposta gerado — `ensure_share_token` marca
 * `proposta_enviada_em` na primeira geração, mesmo instante em que o botão "Enviar" é usado). */
export function propostasEnviadasNoMes(servicos: Servico[], periodo: PeriodoFiltro): IndicadorComercial {
  const chave = chaveDoPeriodo(periodo);
  const registros: RegistroComercial[] = [];
  for (const s of servicos) {
    if (!s.proposta_enviada_em) continue;
    if (yearMonthKeyTz(s.proposta_enviada_em, periodo.timezone) !== chave) continue;
    registros.push({ id: s.id, descricao: `${s.cliente} — ${s.descricao}`, valor: s.valor, data: s.proposta_enviada_em });
  }
  return { total: registros.reduce((sum, r) => sum + r.valor, 0), quantidade: registros.length, registros };
}

/** Aprovados no mês — reaproveita a regra oficial `vendasAprovadas` (financas.ts) em vez de
 * recalcular: "aprovado" pro CRM é exatamente a mesma coisa que "venda" pro Financeiro. */
export function aprovadosNoMes(servicos: Servico[], periodo: PeriodoFiltro): IndicadorComercial {
  const v = vendasAprovadas(servicos, periodo);
  return { total: v.total, quantidade: v.quantidade, registros: v.registros };
}

/** Oportunidades perdidas no mês (motivo_perda registrado, só se aplica a orçamento que nunca
 * virou OS — perder_orcamento já garante isso no banco). */
export function perdidosNoMes(servicos: Servico[], periodo: PeriodoFiltro): IndicadorComercial {
  const chave = chaveDoPeriodo(periodo);
  const registros: RegistroComercial[] = [];
  for (const s of servicos) {
    if (!s.perdido_em) continue;
    if (yearMonthKeyTz(s.perdido_em, periodo.timezone) !== chave) continue;
    registros.push({ id: s.id, descricao: `${s.cliente} — ${s.motivo_perda ?? "sem motivo"}`, valor: s.valor, data: s.perdido_em });
  }
  return { total: registros.reduce((sum, r) => sum + r.valor, 0), quantidade: registros.length, registros };
}

/** Aprovados / (aprovados + perdidos) do mês — 0 quando não há desfecho nenhum ainda (evita
 * dividir por zero, não confundir com "0% de conversão"). */
export function taxaConversao(aprovados: number, perdidos: number): number {
  const desfechos = aprovados + perdidos;
  return desfechos > 0 ? aprovados / desfechos : 0;
}

export function ticketMedioAprovado(aprovados: IndicadorComercial): number {
  return aprovados.quantidade > 0 ? aprovados.total / aprovados.quantidade : 0;
}

/** Estado atual do funil (não escopado a um mês — é uma foto de agora): propostas com link já
 * enviado, ainda sem resposta (nem aprovado nem perdido). */
export function propostasAguardandoResposta(servicos: Servico[]): RegistroComercial[] {
  return servicos
    .filter((s) => s.proposta_enviada_em && oportunidadeAberta(s))
    .map((s) => ({ id: s.id, descricao: `${s.cliente} — ${s.descricao}`, valor: s.valor, data: s.proposta_enviada_em! }));
}

/** Dentro das que aguardam resposta, as que não têm nenhuma data de follow-up agendada —
 * risco de esquecer de cobrar o cliente. */
export function propostasSemFollowUp(servicos: Servico[]): RegistroComercial[] {
  return servicos
    .filter((s) => s.proposta_enviada_em && oportunidadeAberta(s) && !s.data_follow_up)
    .map((s) => ({ id: s.id, descricao: `${s.cliente} — ${s.descricao}`, valor: s.valor, data: s.proposta_enviada_em! }));
}

/** Validade da proposta (`validade_proposta_dias`, já existe desde a Fase 5) contada a partir
 * de quando foi enviada — vencida = hoje já passou dessa data e a oportunidade segue aberta. */
export function propostasVencidas(servicos: Servico[], hojeISO: string): RegistroComercial[] {
  return servicos
    .filter((s) => {
      if (!s.proposta_enviada_em || !oportunidadeAberta(s)) return false;
      const enviadaISO = s.proposta_enviada_em.slice(0, 10);
      const vencimento = addDaysISO(enviadaISO, s.validade_proposta_dias);
      return vencimento < hojeISO;
    })
    .map((s) => ({ id: s.id, descricao: `${s.cliente} — ${s.descricao}`, valor: s.valor, data: s.proposta_enviada_em! }));
}

export interface AlertaComercial {
  servicoId: string;
  texto: string;
  cor: string;
}

const DIAS_PARADO_SEM_ENVIO = 7;
const DIAS_AVISO_VALIDADE = 3;

/** Central de atenção comercial — nunca dispara ação nenhuma sozinha, só sinaliza. */
export function alertasComerciais(servicos: Servico[], hojeISO: string): AlertaComercial[] {
  const alertas: AlertaComercial[] = [];

  for (const s of servicos) {
    if (!oportunidadeAberta(s)) continue;

    if (s.data_follow_up && s.data_follow_up < hojeISO) {
      alertas.push({ servicoId: s.id, texto: `${s.cliente}: follow-up vencido (${s.data_follow_up})`, cor: "#e05252" });
    }

    if (!s.proposta_enviada_em) {
      const diasParado = Math.floor((new Date(hojeISO).getTime() - new Date(s.criado_em).getTime()) / 86_400_000);
      if (diasParado >= DIAS_PARADO_SEM_ENVIO) {
        alertas.push({ servicoId: s.id, texto: `${s.cliente}: orçamento parado há ${diasParado} dias, sem proposta enviada`, cor: "#e0a852" });
      }
      continue;
    }

    const enviadaISO = s.proposta_enviada_em.slice(0, 10);
    const vencimento = addDaysISO(enviadaISO, s.validade_proposta_dias);
    if (vencimento < hojeISO) {
      alertas.push({ servicoId: s.id, texto: `${s.cliente}: proposta vencida (validade era ${vencimento})`, cor: "#e05252" });
    } else {
      const diasAteVencer = Math.round((new Date(vencimento).getTime() - new Date(hojeISO).getTime()) / 86_400_000);
      if (diasAteVencer <= DIAS_AVISO_VALIDADE) {
        alertas.push({ servicoId: s.id, texto: `${s.cliente}: proposta vence em ${diasAteVencer} dia(s)`, cor: "#e0a852" });
      }
    }

    if (!s.data_follow_up) {
      alertas.push({ servicoId: s.id, texto: `${s.cliente}: proposta enviada sem follow-up agendado`, cor: "#e0a852" });
    }
  }

  return alertas;
}

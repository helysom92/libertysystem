import { hojeISOOperacao } from "./dates";

/** Mês/ano selecionado no Financeiro (Etapa 3) — vem sempre da URL (`?ano=&mes=`), nunca de
 * estado de componente, pra persistir ao trocar de aba, recarregar a página ou voltar de um
 * detalhamento. Ausente/inválido cai no mês atual (fuso da operação). */
export function resolverPeriodoDaUrl(params: { ano?: string; mes?: string }): { ano: number; mes: number } {
  const hoje = hojeISOOperacao();
  const [anoAtual, mesAtual] = hoje.split("-").map(Number);
  const ano = Number(params.ano);
  const mes = Number(params.mes);
  if (!Number.isInteger(ano) || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    return { ano: anoAtual, mes: mesAtual };
  }
  return { ano, mes };
}

import { FUSO_OPERACAO } from "./dates";
import { alertasComerciais, propostasAguardandoResposta, propostasVencidas } from "./comercial";
import { contasAPagar, despesasAtrasadas } from "./dashboardMetrics";
import { deslocarISO } from "./filaConfirmacao";
import { aReceber, despesasPagas, excluirPrevistosDeServicoCancelado, recebido, type PeriodoFiltro } from "./financas";
import type {
  DespesaFixa,
  DespesaFixaOcorrencia,
  DespesaVariavel,
  DespesaVariavelOcorrencia,
  Lancamento,
  Servico,
  ServicoParcela,
} from "./types";

/**
 * Revisão semanal (toda segunda-feira): junta, numa visão só, o que precisa de atenção.
 * Puro e sem rede — só chama as funções oficiais já usadas nas outras telas (nada de fórmula
 * nova), então os números aqui batem com os do Financeiro, Hoje e Comercial.
 */

/** Segunda-feira da semana de `iso` (domingo pertence à semana que termina nele). */
export function inicioDaSemana(iso: string): string {
  const dia = new Date(iso + "T00:00:00Z").getUTCDay(); // 0 = domingo
  return deslocarISO(iso, -((dia + 6) % 7));
}

export function fimDaSemana(iso: string): string {
  return deslocarISO(inicioDaSemana(iso), 6);
}

export interface ItemRevisao {
  id: string;
  descricao: string;
  valor: number;
  data: string;
}

export interface Revisao {
  semanaInicio: string;
  semanaFim: string;
  janela: { inicio: string; fim: string }; // hoje → hoje + 6
  entregas: { atrasadas: ItemRevisao[]; proximas: ItemRevisao[] };
  pagar: { vencidas: ItemRevisao[]; proximas: ItemRevisao[] };
  receber: { atrasadas: ItemRevisao[]; proximas: ItemRevisao[] };
  fluxoSemanaAnterior: {
    inicio: string;
    fim: string;
    recebido: number;
    pago: number;
    resultado: number;
    qtdRecebido: number;
    qtdPago: number;
  };
  previsao: { entra: number; sai: number; saldo: number };
  comercial: { aguardandoResposta: ItemRevisao[]; propostasVencidas: ItemRevisao[]; alertas: string[] };
}

export interface DadosRevisao {
  hojeISO: string;
  servicos: Servico[];
  lancamentos: Lancamento[];
  servicoParcelas: ServicoParcela[];
  despesasFixas: DespesaFixa[];
  despesasFixasOcorrencias: DespesaFixaOcorrencia[];
  despesasVariaveis: DespesaVariavel[];
  despesasVariaveisOcorrencias: DespesaVariavelOcorrencia[];
}

const soma = (itens: ItemRevisao[]) => itens.reduce((s, i) => s + i.valor, 0);
const porData = (a: ItemRevisao, b: ItemRevisao) => a.data.localeCompare(b.data);

function mesesDaJanela(inicio: string, fim: string): { ano: number; mes: number }[] {
  const meses = new Map<string, { ano: number; mes: number }>();
  for (const iso of [inicio, fim]) {
    const [ano, mes] = iso.split("-").map(Number);
    meses.set(`${ano}-${mes}`, { ano, mes });
  }
  return [...meses.values()];
}

/** `aReceber` só usa inicio/fim do período — o resto é preenchido só pra fechar o tipo. */
function periodoLivre(inicio: string, fim: string): PeriodoFiltro {
  return { ano: 0, mes: 0, inicio, fim, timezone: FUSO_OPERACAO };
}

function entregas(servicos: Servico[], hojeISO: string, fimJanela: string) {
  const abertas = servicos.filter((s) => s.numero != null && !s.concluido && s.prazo);
  const item = (s: Servico): ItemRevisao => ({
    id: s.id,
    descricao: `${s.numero} — ${s.cliente}`,
    valor: s.valor,
    data: s.prazo!,
  });
  return {
    atrasadas: abertas.filter((s) => s.prazo! < hojeISO).map(item).sort(porData),
    proximas: abertas.filter((s) => s.prazo! >= hojeISO && s.prazo! <= fimJanela).map(item).sort(porData),
  };
}

function contasPagar(dados: DadosRevisao, previstosDespesa: Lancamento[], hojeISO: string, fimJanela: string) {
  const vistos = new Map<string, { item: ItemRevisao; atrasado: boolean }>();
  const [anoHoje, mesHoje] = hojeISO.split("-").map(Number);

  for (const { ano, mes } of mesesDaJanela(hojeISO, fimJanela)) {
    // Mês corrente sem `refAnoMes`: despesa variável sem data conta como "vence hoje" (mesma
    // regra do Hoje/Financeiro), em vez de cair no dia 1 e virar "vencida".
    const doMesCorrente = ano === anoHoje && mes === mesHoje;
    const itens = contasAPagar(
      dados.despesasFixas,
      dados.despesasFixasOcorrencias,
      dados.despesasVariaveis,
      dados.despesasVariaveisOcorrencias,
      previstosDespesa,
      hojeISO,
      doMesCorrente ? undefined : { ano, mes }
    );
    for (const i of itens) {
      const chave = `${i.tipo}:${i.id}:${i.vencimento}`;
      if (!vistos.has(chave)) {
        vistos.set(chave, {
          item: { id: i.id, descricao: i.descricao, valor: i.valor, data: i.vencimento },
          atrasado: i.atrasado,
        });
      }
    }
  }

  const todos = [...vistos.values()];
  const vencidas: ItemRevisao[] = todos.filter((i) => i.atrasado).map((i) => i.item);

  // Ocorrências não pagas de meses anteriores (sem dia certo) — também estão vencidas.
  for (const a of despesasAtrasadas(
    dados.despesasFixas,
    dados.despesasFixasOcorrencias,
    dados.despesasVariaveis,
    dados.despesasVariaveisOcorrencias,
    anoHoje,
    mesHoje
  )) {
    vencidas.push({
      id: a.despesaId,
      descricao: `${a.descricao} (${String(a.mes).padStart(2, "0")}/${a.ano})`,
      valor: a.valor,
      data: `${a.ano}-${String(a.mes).padStart(2, "0")}-01`,
    });
  }

  const proximas = todos
    .filter((i) => !i.atrasado && i.item.data >= hojeISO && i.item.data <= fimJanela)
    .map((i) => i.item);

  return { vencidas: vencidas.sort(porData), proximas: proximas.sort(porData) };
}

export function montarRevisao(dados: DadosRevisao): Revisao {
  const { hojeISO } = dados;
  const fimJanela = deslocarISO(hojeISO, 6);
  const semanaInicio = inicioDaSemana(hojeISO);

  const previstos = excluirPrevistosDeServicoCancelado(
    dados.lancamentos.filter((l) => l.status === "previsto"),
    dados.servicos
  );
  const previstosReceita = previstos.filter((l) => l.tipo === "Receita");
  const previstosDespesa = previstos.filter((l) => l.tipo === "Despesa");

  const pagar = contasPagar(dados, previstosDespesa, hojeISO, fimJanela);

  const receberAtrasadas = aReceber(
    dados.servicos,
    dados.servicoParcelas,
    previstosReceita,
    periodoLivre("0000-01-01", deslocarISO(hojeISO, -1)),
    hojeISO
  ).registros;
  const receberProximas = aReceber(
    dados.servicos,
    dados.servicoParcelas,
    previstosReceita,
    periodoLivre(hojeISO, fimJanela),
    hojeISO
  ).registros;
  const receber = { atrasadas: [...receberAtrasadas].sort(porData), proximas: [...receberProximas].sort(porData) };

  const anterior = { inicio: deslocarISO(semanaInicio, -7), fim: deslocarISO(semanaInicio, -1) };
  const rec = recebido(dados.lancamentos, anterior);
  const pag = despesasPagas(dados.lancamentos, anterior);

  const entra = soma(receber.proximas);
  const sai = soma(pagar.proximas);

  return {
    semanaInicio,
    semanaFim: deslocarISO(semanaInicio, 6),
    janela: { inicio: hojeISO, fim: fimJanela },
    entregas: entregas(dados.servicos, hojeISO, fimJanela),
    pagar,
    receber,
    fluxoSemanaAnterior: {
      ...anterior,
      recebido: rec.total,
      pago: pag.total,
      resultado: rec.total - pag.total,
      qtdRecebido: rec.quantidade,
      qtdPago: pag.quantidade,
    },
    previsao: { entra, sai, saldo: entra - sai },
    comercial: {
      aguardandoResposta: propostasAguardandoResposta(dados.servicos),
      propostasVencidas: propostasVencidas(dados.servicos, hojeISO),
      alertas: alertasComerciais(dados.servicos, hojeISO).map((a) => a.texto),
    },
  };
}

/** O que vai guardado no registro de conclusão: contagens e totais de cada seção, pra
 * consultar depois "como estava a semana quando eu revisei". */
export function resumoDaRevisao(r: Revisao, bancoPendentes: number | null) {
  const bloco = (itens: ItemRevisao[]) => ({ quantidade: itens.length, total: soma(itens) });
  return {
    banco: { pendentes: bancoPendentes },
    entregas: { atrasadas: r.entregas.atrasadas.length, proximas: r.entregas.proximas.length },
    pagar: { vencidas: bloco(r.pagar.vencidas), proximas: bloco(r.pagar.proximas) },
    receber: { atrasadas: bloco(r.receber.atrasadas), proximas: bloco(r.receber.proximas) },
    fluxoSemanaAnterior: {
      recebido: r.fluxoSemanaAnterior.recebido,
      pago: r.fluxoSemanaAnterior.pago,
      resultado: r.fluxoSemanaAnterior.resultado,
    },
    previsao: r.previsao,
    comercial: {
      aguardandoResposta: r.comercial.aguardandoResposta.length,
      propostasVencidas: r.comercial.propostasVencidas.length,
      alertas: r.comercial.alertas.length,
    },
  };
}

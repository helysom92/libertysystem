import { diasEntre, ehMovimentacaoInterna } from "./extrato";
import { sugerirPorRegra, type RegraLancamento } from "./regras";
import type { Lancamento, Servico, ServicoParcela, UnidadeNegocio } from "./types";
import { sugerirClientes, type ClienteParaCruzamento, type ClienteProvavel } from "./vinculoCliente";

/** Parcela de OS em aberto que pode ser este Pix — vira pergunta "corresponde?". */
export interface CandidatoRecebivel {
  parcelaId: string;
  servicoId: string;
  descricao: string;
  saldo: number;
  dataPrevista: string | null;
  /** "valor igual": saldo = valor do Pix. "mesmo cliente": o pagador parece ser o cliente da OS. */
  motivo: "valor igual" | "mesmo cliente";
}

export type ServicoParaCruzamento = Pick<Servico, "id" | "numero" | "cliente" | "cliente_id" | "financeiro_status">;

export interface DadosRecebiveis {
  parcelas: ServicoParcela[];
  servicos: ServicoParaCruzamento[];
  clientes?: ClienteParaCruzamento[];
}

/** O que o Mercado Pago entregou sobre quem pagou (nome costuma vir mascarado no Pix). */
export interface PagadorInfo {
  nome: string | null;
  banco: string | null;
  documento: string | null;
  tipoDocumento: string | null;
  email: string | null;
}

export interface MovimentoSincronizado {
  id: string;
  data: string;
  descricao: string;
  contraparte: string | null;
  valor: number;
  tipo: "Receita" | "Despesa";
  conciliado: boolean;
  ignorado_em: string | null;
  pagador?: PagadorInfo | null;
}

export interface ItemFila {
  movimento: MovimentoSincronizado;
  regra: RegraLancamento | null;
  categoriaSugerida: string;
  unidadeSugerida: UnidadeNegocio | null;
  /** Lançamentos *previstos* (ex: boleto já lançado) que parecem ser esta saída/entrada — o
   * caminho certo é dar baixa neles, em vez de criar um lançamento duplicado. */
  baixas: Lancamento[];
  /** Entrada que bate com o saldo de uma parcela de OS em aberto (ou é do cliente dela):
   * perguntar se corresponde. */
  recebiveis: CandidatoRecebivel[];
  /** Clientes que o pagador parece ser (CPF/CNPJ e nome da conta) — só sugestão. */
  clientesProvaveis: ClienteProvavel[];
}

export interface FilaClassificada {
  itens: ItemFila[];
  jaLancados: number;
}

const JANELA_REALIZADO_DIAS = 5;
const JANELA_BAIXA_DIAS = 7;

function mesmoValor(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.01;
}

function distanciaDias(dataPrevista: string | null, dataMovimento: string): number {
  return dataPrevista ? diasEntre(dataPrevista, dataMovimento) : Number.POSITIVE_INFINITY;
}

export function deslocarISO(iso: string, dias: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Separa o que ainda precisa da sua confirmação: ignora o que já foi conciliado/ignorado, o
 * que já bate com um lançamento realizado (nada a fazer) e movimentação interna; do resto,
 * sugere "dar baixa" quando há um lançamento previsto equivalente, ou "lançar novo" com a
 * categoria/unidade da regra aprendida. Nunca cria nada — só classifica.
 */
export function classificarMovimentos(
  movimentos: MovimentoSincronizado[],
  lancamentos: Lancamento[],
  regras: RegraLancamento[],
  meuNome: string,
  recebiveis: DadosRecebiveis = { parcelas: [], servicos: [] }
): FilaClassificada {
  const clientes = recebiveis.clientes ?? [];
  const pendentes = movimentos
    .filter((m) => !m.conciliado && !m.ignorado_em)
    .sort((a, b) => a.data.localeCompare(b.data));
  const validos = lancamentos.filter((l) => l.status !== "cancelado");
  const realizados = validos.filter((l) => l.status === "realizado");
  // Lançamento previsto que pertence a uma parcela de OS NÃO pode ser baixado sozinho (a
  // parcela continuaria em aberto e o dinheiro contaria duas vezes): ele só se resolve pelo
  // recebimento da parcela — por isso sai daqui e aparece como `recebiveis`.
  const lancamentosDeParcela = new Set(recebiveis.parcelas.map((p) => p.lancamento_id).filter((id): id is string => !!id));
  const previstos = validos.filter((l) => l.status === "previsto" && !lancamentosDeParcela.has(l.id));

  const servicoPorId = new Map(recebiveis.servicos.map((s) => [s.id, s]));
  const parcelasAbertas = recebiveis.parcelas
    .filter((p) => !p.cancelada_em && servicoPorId.get(p.servico_id)?.financeiro_status !== "Cancelado")
    .map((p) => ({ parcela: p, saldo: Math.max(0, p.valor_previsto - (p.valor_pago ?? 0)) }))
    .filter((x) => x.saldo > 0);

  const usadosRealizado = new Set<string>();
  const usadosPrevisto = new Set<string>();
  const usadasParcelas = new Set<string>();
  const itens: ItemFila[] = [];
  let jaLancados = 0;

  for (const m of pendentes) {
    const texto = [m.contraparte, m.descricao].filter(Boolean).join(" ");
    if (ehMovimentacaoInterna(texto, meuNome)) continue;

    const jaTem = realizados.find(
      (l) =>
        !usadosRealizado.has(l.id) &&
        l.tipo === m.tipo &&
        mesmoValor(l.valor, m.valor) &&
        diasEntre(l.data, m.data) <= JANELA_REALIZADO_DIAS
    );
    if (jaTem) {
      usadosRealizado.add(jaTem.id);
      jaLancados += 1;
      continue;
    }

    const baixas = previstos
      .filter(
        (l) =>
          !usadosPrevisto.has(l.id) &&
          l.tipo === m.tipo &&
          mesmoValor(l.valor, m.valor) &&
          diasEntre(l.data, m.data) <= JANELA_BAIXA_DIAS
      )
      .sort((a, b) => diasEntre(a.data, m.data) - diasEntre(b.data, m.data))
      .slice(0, 3);
    if (baixas[0]) usadosPrevisto.add(baixas[0].id);

    // Quem pagou parece ser qual cliente? Só o nome da conta/descrição entra (nunca o banco: "Sicredi"
    // casaria com qualquer um) + o CPF/CNPJ que o Mercado Pago mandar.
    const clientesProvaveis =
      m.tipo === "Receita"
        ? sugerirClientes([m.pagador?.nome, m.descricao], m.pagador?.documento, clientes)
        : [];
    const doMesmoCliente = new Set(clientesProvaveis.filter((c) => c.pontos >= 60).map((c) => c.clienteId));

    const comoCandidato = (
      { parcela, saldo }: (typeof parcelasAbertas)[number],
      motivo: CandidatoRecebivel["motivo"]
    ): CandidatoRecebivel => {
      const servico = servicoPorId.get(parcela.servico_id);
      return {
        parcelaId: parcela.id,
        servicoId: parcela.servico_id,
        descricao: `${servico?.numero ?? "—"} — ${servico?.cliente ?? "cliente"} · ${parcela.descricao}`,
        saldo,
        dataPrevista: parcela.data_prevista,
        motivo,
      };
    };
    const maisProximaPrimeiro = (a: (typeof parcelasAbertas)[number], b: (typeof parcelasAbertas)[number]) => {
      const da = distanciaDias(a.parcela.data_prevista, m.data);
      const db = distanciaDias(b.parcela.data_prevista, m.data);
      return da === db ? 0 : da - db;
    };

    // Entrada com o mesmo valor do saldo de uma parcela em aberto: "corresponde?". Sem janela de
    // data (Pix pode chegar semanas depois do vencimento); a primeira fica reservada pra não
    // oferecer a mesma parcela a dois Pix. Depois vêm as parcelas do mesmo cliente (valor
    // diferente: pode ser pagamento parcial) — nunca mais que o saldo.
    const exatas =
      m.tipo === "Receita"
        ? parcelasAbertas
            .filter((x) => !usadasParcelas.has(x.parcela.id) && mesmoValor(x.saldo, m.valor))
            .sort(maisProximaPrimeiro)
            .slice(0, 3)
        : [];
    const idsExatas = new Set(exatas.map((x) => x.parcela.id));
    const doCliente =
      m.tipo === "Receita" && doMesmoCliente.size > 0
        ? parcelasAbertas
            .filter(
              (x) =>
                !idsExatas.has(x.parcela.id) &&
                !usadasParcelas.has(x.parcela.id) &&
                doMesmoCliente.has(servicoPorId.get(x.parcela.servico_id)?.cliente_id ?? "") &&
                x.saldo + 0.01 >= m.valor
            )
            .sort(maisProximaPrimeiro)
            .slice(0, 3)
        : [];
    const candidatos = [...exatas.map((x) => comoCandidato(x, "valor igual")), ...doCliente.map((x) => comoCandidato(x, "mesmo cliente"))];
    if (exatas[0]) usadasParcelas.add(exatas[0].parcela.id);

    const regra = sugerirPorRegra(texto, m.tipo, regras);
    itens.push({
      movimento: m,
      regra,
      categoriaSugerida: regra?.categoria || "Geral",
      unidadeSugerida: regra?.unidade_negocio ?? null,
      baixas,
      recebiveis: candidatos,
      clientesProvaveis,
    });
  }

  return { itens, jaLancados };
}

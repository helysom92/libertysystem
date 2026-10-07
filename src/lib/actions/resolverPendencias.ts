"use server";

import { requireRole } from "@/lib/domain/permissions";
import type { AcaoItem } from "@/lib/domain/revisaoSemanal";
import {
  baixarLancamentoPrevisto,
  cancelarLancamento,
  cancelarOcorrenciaDespesaFixa,
  cancelarOcorrenciaDespesaVariavel,
  registrarPagamentoDespesaFixaOcorrencia,
  registrarPagamentoDespesaVariavelOcorrencia,
} from "./financeiro";
import { cancelarParcela, marcarParcelaPaga } from "./parcelas";
import type { AcaoComDado } from "./resultado";

export interface ItemParaResolver {
  acao: AcaoItem;
  descricao: string;
  valor: number;
  /** Vencimento do item — usado como data do pagamento quando `data` = "vencimento". */
  vencimento: string;
}

export interface ResolverPendenciasInput {
  itens: ItemParaResolver[];
  resultado: "pago" | "cancelado";
  /** "vencimento" = cada item paga na própria data de vencimento; senão, uma data única AAAA-MM-DD. */
  data: "vencimento" | string;
  motivo: string | null;
}

export interface ResolverPendenciasResultado {
  feitos: number;
  falhas: { descricao: string; message: string }[];
}

const MAX_POR_CHAMADA = 25;
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Resolve vários itens de uma vez — marcando como pago/recebido ou cancelando — chamando, item a
 * item, as MESMAS ações oficiais das telas (RPCs atômicas, travas de saldo, auditoria em
 * `financeiro_eventos`). Nada é calculado aqui: se uma ação oficial recusar, o item entra em
 * `falhas` e os demais seguem. Reversível por estorno nas telas de sempre.
 */
export async function resolverPendencias(
  input: ResolverPendenciasInput
): Promise<AcaoComDado<ResolverPendenciasResultado>> {
  await requireRole("administrador");

  if (input.itens.length === 0) return { ok: false, message: "Nenhum item selecionado." };
  if (input.itens.length > MAX_POR_CHAMADA) {
    return { ok: false, message: `Selecione no máximo ${MAX_POR_CHAMADA} itens por vez.` };
  }
  if (input.data !== "vencimento" && !DATA_ISO.test(input.data)) {
    return { ok: false, message: "Data inválida." };
  }
  const motivo = input.motivo?.trim() || null;
  if (input.resultado === "cancelado" && !motivo) {
    return { ok: false, message: "Diga o motivo do cancelamento." };
  }

  const falhas: ResolverPendenciasResultado["falhas"] = [];
  let feitos = 0;

  for (const item of input.itens) {
    const data = input.data === "vencimento" ? item.vencimento.slice(0, 10) : input.data;
    const { acao } = item;
    let resposta: { ok: true } | { ok: false; message: string };

    if (input.resultado === "pago") {
      if (!(item.valor > 0)) {
        falhas.push({ descricao: item.descricao, message: "Valor zerado — cancele o item ou ajuste o valor antes." });
        continue;
      }
      if (acao.kind === "fixa") {
        resposta = await registrarPagamentoDespesaFixaOcorrencia(acao.despesaFixaId, acao.ano, acao.mes, item.valor, data);
      } else if (acao.kind === "variavel") {
        resposta = await registrarPagamentoDespesaVariavelOcorrencia(acao.despesaVariavelId, acao.ano, acao.mes, item.valor, data);
      } else if (acao.kind === "parcela") {
        resposta = await marcarParcelaPaga(acao.parcelaId, acao.servicoId, {
          valorRecebidoAgora: item.valor,
          dataPagamento: data,
          formaPagamento: null,
        });
      } else {
        resposta = await baixarLancamentoPrevisto(acao.lancamentoId, data);
      }
    } else if (acao.kind === "fixa") {
      resposta = await cancelarOcorrenciaDespesaFixa(acao.despesaFixaId, acao.ano, acao.mes, motivo);
    } else if (acao.kind === "variavel") {
      resposta = await cancelarOcorrenciaDespesaVariavel(acao.despesaVariavelId, acao.ano, acao.mes, motivo);
    } else if (acao.kind === "parcela") {
      resposta = await cancelarParcela(acao.parcelaId, motivo);
    } else {
      resposta = await cancelarLancamento(acao.lancamentoId, motivo);
    }

    if (resposta.ok) feitos += 1;
    else falhas.push({ descricao: item.descricao, message: resposta.message });
  }

  return { ok: true, data: { feitos, falhas } };
}

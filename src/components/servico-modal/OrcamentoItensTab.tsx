"use client";

import { useState } from "react";
import type { ServicoDetail } from "@/lib/domain/types";
import { fmtBRL, type ItemOrcamento, type OrcamentoItemRow } from "@/lib/domain/types";
import {
  CATEGORIA_PRAZO_INFO,
  calcularItemOrcamento,
  type OrcamentoItemDraft,
} from "@/lib/domain/orcamento";
import { buildOrcamentoText, type OrcamentoTextItem } from "@/lib/domain/orcamentoText";

function toDraft(row: OrcamentoItemRow): OrcamentoItemDraft {
  return {
    categoriaPrazo: row.categoria_prazo,
    modoCalculo: row.modo_calculo,
    itemOrcamentoId: row.item_orcamento_id,
    larguraCm: row.largura_cm ?? 0,
    alturaCm: row.altura_cm ?? 0,
    quantidade: row.quantidade,
    custoDireto: row.custo_direto ?? 0,
    precoM2Manual: row.preco_m2_manual ?? 0,
  };
}

export default function OrcamentoItensTab({
  detail,
  itensOrcamento,
}: {
  detail: ServicoDetail;
  itensOrcamento: ItemOrcamento[];
}) {
  const [copiado, setCopiado] = useState(false);
  const itens = detail.orcamentoItens;

  const total = itens.reduce((sum, item) => sum + item.valor_final, 0);
  const maxRank = itens.reduce(
    (max, item) => Math.max(max, CATEGORIA_PRAZO_INFO[item.categoria_prazo].rank),
    0
  );
  const prazoEstimadoLabel = Object.values(CATEGORIA_PRAZO_INFO).find((c) => c.rank === maxRank)?.prazoLabel;

  async function copiarOrcamento() {
    const textItens: OrcamentoTextItem[] = itens.map((row) => {
      const calc = calcularItemOrcamento(toDraft(row), itensOrcamento);
      const itemCatalogo = itensOrcamento.find((i) => i.id === row.item_orcamento_id);
      return {
        descricao: row.descricao,
        categoriaPrazo: row.categoria_prazo,
        modoCalculo: row.modo_calculo,
        itemNome: itemCatalogo?.nome,
        larguraCm: row.largura_cm,
        alturaCm: row.altura_cm,
        quantidade: row.quantidade,
        area: calc.area,
        unit: calc.unit,
        minimoAplicado: calc.minimoAplicado,
        valorFinal: row.valor_final,
      };
    });

    const texto = buildOrcamentoText(textItens, {
      clienteNome: detail.cliente.nome,
      clienteTelefone: detail.cliente.whatsapp,
      local: detail.cliente.endereco,
      validadeDias: 7,
      condicoes: { entrada50: false, cartao: false, desconto: false },
      observacoes: null,
    });

    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      // best-effort
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
    const digits = (detail.cliente.whatsapp ?? "").replace(/\D/g, "");
    window.open(`https://wa.me/55${digits}?text=${encodeURIComponent(texto)}`, "_blank");
  }

  if (itens.length === 0) {
    return <p className="text-sm text-text-muted">Este serviço não tem itens de orçamento detalhados.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {itens.map((row) => {
        const calc = calcularItemOrcamento(toDraft(row), itensOrcamento);
        const itemCatalogo = itensOrcamento.find((i) => i.id === row.item_orcamento_id);
        return (
          <div
            key={row.id}
            className="rounded-card border border-border-neutral bg-card-secondary p-3 text-[12.5px]"
          >
            <div className="mb-1 flex items-center justify-between">
              <strong>{row.descricao || "(sem descrição)"}</strong>
              <span className="rounded-btn border border-border-neutral px-2 py-0.5 text-[11px] text-text-secondary">
                {CATEGORIA_PRAZO_INFO[row.categoria_prazo].label}
              </span>
            </div>
            <p className="text-text-muted">
              {row.modo_calculo === "catalogo" &&
                (calc.area != null
                  ? `${itemCatalogo?.nome ?? "-"} · ${row.largura_cm}cm x ${row.altura_cm}cm x ${row.quantidade}un = ${calc.area.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} m²`
                  : `${itemCatalogo?.nome ?? "-"} · Qtd: ${row.quantidade}`)}
              {row.modo_calculo === "m2_manual" &&
                `${row.largura_cm}cm x ${row.altura_cm}cm x ${row.quantidade}un = ${(calc.area ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} m² (${fmtBRL(calc.unit)}/m²)`}
              {row.modo_calculo === "formula" && `Qtd: ${row.quantidade} · Valor unit: ${fmtBRL(calc.unit)}`}
              {calc.minimoAplicado && " · pedido mínimo aplicado"}
            </p>
            <p className="mt-1 text-right font-semibold text-text">{fmtBRL(row.valor_final)}</p>
          </div>
        );
      })}

      <div className="flex items-center justify-between rounded-card bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-4 py-3">
        <span className="text-[13px] font-semibold text-bg">Total do orçamento</span>
        <span className="font-display text-lg font-bold text-bg">{fmtBRL(total)}</span>
      </div>
      {prazoEstimadoLabel && (
        <p className="text-[11.5px] text-text-muted">Prazo estimado de entrega: {prazoEstimadoLabel}</p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={copiarOrcamento}
          className="rounded-btn border border-border-neutral px-3 py-1.5 text-[12.5px]"
          style={{ color: "#25D366" }}
        >
          📋 Copiar Orçamento
        </button>
        {copiado && <span className="text-[11.5px] text-success">Copiado!</span>}
      </div>
    </div>
  );
}

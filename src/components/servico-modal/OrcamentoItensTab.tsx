"use client";

import { useState } from "react";
import type { ServicoDetail } from "@/lib/domain/types";
import { fmtBRL, type ItemOrcamento, type OrcamentoItemRow } from "@/lib/domain/types";
import {
  CATEGORIA_PRAZO_INFO,
  LINHA_ORCAMENTO_INFO,
  calcularItemOrcamento,
  prazoEstimadoLabel,
  unitParaExibicao,
  type LinhaOrcamento,
  type OrcamentoItemDraft,
} from "@/lib/domain/orcamento";
import { buildOrcamentoText, type OrcamentoTextItem } from "@/lib/domain/orcamentoText";
import { ensureShareToken, updatePropostaOrcamento } from "@/lib/actions/servicos";
import { whatsappAppUrl } from "@/lib/domain/whatsapp";

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
  onChanged,
}: {
  detail: ServicoDetail;
  itensOrcamento: ItemOrcamento[];
  onChanged: () => void;
}) {
  const { servico } = detail;
  const [copiado, setCopiado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const itens = detail.orcamentoItens;

  const [linha, setLinha] = useState<LinhaOrcamento>(servico.linha_orcamento);
  const [validadeDias, setValidadeDias] = useState(String(servico.validade_proposta_dias));
  const [formaPagamento, setFormaPagamento] = useState(servico.forma_pagamento_texto ?? "");
  const [durabilidade, setDurabilidade] = useState(servico.durabilidade_texto ?? "");
  const [propostaDirty, setPropostaDirty] = useState(false);
  const [propostaSaving, setPropostaSaving] = useState(false);
  const [propostaError, setPropostaError] = useState<string | null>(null);
  const [enviarError, setEnviarError] = useState<string | null>(null);

  const total = itens.reduce((sum, item) => sum + item.valor_final, 0);
  const prazoLabel = prazoEstimadoLabel(itens.map((i) => i.categoria_prazo));

  async function salvarProposta() {
    setPropostaSaving(true);
    setPropostaError(null);
    try {
      await updatePropostaOrcamento(servico.id, {
        linha_orcamento: linha,
        validade_proposta_dias: Number(validadeDias) || 7,
        forma_pagamento_texto: formaPagamento || null,
        durabilidade_texto: durabilidade || null,
      });
      setPropostaDirty(false);
      onChanged();
    } catch (err) {
      setPropostaError(err instanceof Error ? err.message : "Erro desconhecido ao salvar.");
    } finally {
      setPropostaSaving(false);
    }
  }

  async function enviarPorWhatsapp() {
    setEnviando(true);
    setEnviarError(null);
    try {
      const token = await ensureShareToken(servico.id);
      const link = `${window.location.origin}/proposta/${token}`;
      const texto = `Olá ${detail.cliente.nome.split(" ")[0]}! Segue sua proposta da Liberty Visual e Marketing: ${link}`;
      window.open(whatsappAppUrl(detail.cliente.whatsapp, texto), "_blank");
    } catch (err) {
      console.error("Falha ao gerar link da proposta", err);
      setEnviarError(err instanceof Error ? err.message : "Não foi possível gerar o link da proposta.");
    } finally {
      setEnviando(false);
    }
  }

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
        unit: unitParaExibicao(row.modo_calculo, calc, row.valor_final, row.quantidade),
        minimoAplicado: calc.minimoAplicado,
        valorFinal: row.valor_final,
      };
    });

    const texto = buildOrcamentoText(textItens, {
      clienteNome: detail.cliente.nome,
      clienteTelefone: detail.cliente.whatsapp,
      local: detail.cliente.endereco,
      validadeDias: Number(validadeDias) || 7,
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
    window.open(whatsappAppUrl(detail.cliente.whatsapp, texto), "_blank");
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[10.5px] tracking-wide text-text-muted uppercase">
        Proposta (documento visual)
      </p>
      <div className="rounded-card border border-border-neutral bg-card-secondary p-3">
        <div className="mb-2 flex gap-1">
          {(Object.keys(LINHA_ORCAMENTO_INFO) as LinhaOrcamento[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => {
                setLinha(l);
                setPropostaDirty(true);
              }}
              className={`flex-1 rounded-btn border px-2 py-1.5 text-[11.5px] ${
                linha === l
                  ? "border-gold bg-gold/10 text-gold"
                  : "border-border-neutral text-text-secondary"
              }`}
            >
              {LINHA_ORCAMENTO_INFO[l].label}
            </button>
          ))}
        </div>

        <div className="mb-2 flex gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-[11px] text-text-secondary">Forma de pagamento</label>
            <textarea
              value={formaPagamento}
              onChange={(e) => {
                setFormaPagamento(e.target.value);
                setPropostaDirty(true);
              }}
              rows={2}
              placeholder="A combinar"
              className="w-full rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-[12.5px]"
            />
          </div>
        </div>

        <div className="mb-2 flex gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-[11px] text-text-secondary">
              Durabilidade estimada (opcional)
            </label>
            <input
              value={durabilidade}
              onChange={(e) => {
                setDurabilidade(e.target.value);
                setPropostaDirty(true);
              }}
              placeholder="Ex: 2 a 5 anos, pintura sem desbotar"
              className="w-full rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-[12.5px]"
            />
          </div>
          <div className="w-28">
            <label className="mb-1 block text-[11px] text-text-secondary">Validade (dias)</label>
            <input
              type="number"
              value={validadeDias}
              onChange={(e) => {
                setValidadeDias(e.target.value);
                setPropostaDirty(true);
              }}
              className="w-full rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-[12.5px]"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={salvarProposta}
            disabled={!propostaDirty || propostaSaving}
            className="w-fit rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-3 py-1.5 text-[12.5px] font-semibold text-bg disabled:opacity-40"
          >
            {propostaSaving ? "Salvando..." : "Salvar"}
          </button>
          {propostaError && (
            <p className="text-[12px] text-danger">Não foi possível salvar: {propostaError}</p>
          )}
        </div>
      </div>

      {itens.length === 0 ? (
        <p className="text-sm text-text-muted">Este serviço não tem itens de orçamento detalhados.</p>
      ) : (
        <>
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
                  {row.modo_calculo === "formula" &&
                    `Qtd: ${row.quantidade} · Valor unit: ${fmtBRL(unitParaExibicao(row.modo_calculo, calc, row.valor_final, row.quantidade))}`}
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
          {prazoLabel && (
            <p className="text-[11.5px] text-text-muted">Prazo estimado de entrega: {prazoLabel}</p>
          )}
        </>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <a
          href={`/servicos/${servico.id}/imprimir`}
          target="_blank"
          rel="noreferrer"
          className="rounded-btn border border-border-neutral px-3 py-1.5 text-[12.5px] text-text-secondary"
        >
          🖨️ Imprimir / Ver documento
        </a>
        <button
          type="button"
          onClick={enviarPorWhatsapp}
          disabled={enviando}
          className="rounded-btn border border-border-neutral px-3 py-1.5 text-[12.5px] disabled:opacity-40"
          style={{ color: "#25D366" }}
        >
          {enviando ? "Gerando link..." : "📲 Enviar por WhatsApp"}
        </button>
        <button
          type="button"
          onClick={copiarOrcamento}
          disabled={itens.length === 0}
          className="rounded-btn border border-border-neutral px-3 py-1.5 text-[12.5px] disabled:opacity-40"
          style={{ color: "#25D366" }}
        >
          📋 Copiar Orçamento
        </button>
        {copiado && <span className="text-[11.5px] text-success">Copiado!</span>}
      </div>
      {enviarError && <p className="text-[12px] text-danger">{enviarError}</p>}
    </div>
  );
}

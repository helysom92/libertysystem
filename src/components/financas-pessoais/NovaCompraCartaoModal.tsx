"use client";

import { useState, useTransition } from "react";
import type { CartaoPessoal } from "@/lib/domain/types";
import { hojeISOOperacao } from "@/lib/domain/dates";
import { gerarParcelasCompra } from "@/lib/domain/financasPessoais";
import { fmtBRL } from "@/lib/domain/types";
import { createCompraCartao } from "@/lib/actions/financasPessoais";

export default function NovaCompraCartaoModal({ cartao, onClose }: { cartao: CartaoPessoal; onClose: () => void }) {
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("");
  const [valorTotal, setValorTotal] = useState("");
  const [parcelasTotal, setParcelasTotal] = useState("1");
  const [dataCompra, setDataCompra] = useState(hojeISOOperacao());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const valorNum = Number(valorTotal.replace(",", "."));
  const parcelasNum = Math.max(1, Number(parcelasTotal) || 1);
  const preview =
    valorNum > 0 && dataCompra ? gerarParcelasCompra(dataCompra, cartao.dia_fechamento, valorNum, parcelasNum) : [];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!descricao.trim()) {
      setError("Descrição é obrigatória.");
      return;
    }
    if (!valorNum || valorNum <= 0) {
      setError("Informe um valor total maior que zero.");
      return;
    }
    startTransition(async () => {
      const resultado = await createCompraCartao({
        cartaoId: cartao.id,
        descricao: descricao.trim(),
        categoria: categoria.trim() || null,
        valorTotal: valorNum,
        parcelasTotal: parcelasNum,
        dataCompra,
      });
      if (!resultado.ok) {
        setError(resultado.message);
        return;
      }
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-card border border-border-gold bg-card p-6"
      >
        <h2 className="mb-1 font-display text-lg font-bold">Nova Compra — {cartao.nome}</h2>
        <p className="mb-4 text-[12px] text-text-secondary">
          Vira compromisso na(s) fatura(s) — nunca uma despesa por si só até a fatura ser paga.
        </p>

        <label className="mb-1 block text-xs text-text-secondary">Descrição</label>
        <input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className="mb-3 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
        />

        <label className="mb-1 block text-xs text-text-secondary">Categoria (opcional)</label>
        <input
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          className="mb-3 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
        />

        <div className="mb-3 flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Valor total</label>
            <input
              value={valorTotal}
              onChange={(e) => setValorTotal(e.target.value)}
              inputMode="decimal"
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Parcelas</label>
            <input
              value={parcelasTotal}
              onChange={(e) => setParcelasTotal(e.target.value)}
              inputMode="numeric"
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            />
          </div>
        </div>

        <label className="mb-1 block text-xs text-text-secondary">Data da compra</label>
        <input
          type="date"
          value={dataCompra}
          onChange={(e) => setDataCompra(e.target.value)}
          className="mb-3 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
        />

        {preview.length > 0 && (
          <div className="mb-4 rounded-btn bg-card-secondary p-3 text-[11.5px] text-text-secondary">
            {preview.map((p) => (
              <div key={p.numero} className="flex justify-between">
                <span>
                  Parcela {p.numero}/{parcelasNum} — fatura {String(p.mes).padStart(2, "0")}/{p.ano}
                </span>
                <span className="font-semibold text-text">{fmtBRL(p.valor)}</span>
              </div>
            ))}
          </div>
        )}

        {error && <p className="mb-3 text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-btn px-4 py-2 text-sm text-text-secondary hover:text-text">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-4 py-2 text-sm font-semibold text-bg disabled:opacity-60"
          >
            {pending ? "Salvando..." : "Registrar Compra"}
          </button>
        </div>
      </form>
    </div>
  );
}

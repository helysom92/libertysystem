"use client";

import { useState, useTransition } from "react";
import type { DividaPessoal } from "@/lib/domain/types";
import { createDivida, updateDivida, type DividaInput } from "@/lib/actions/financasPessoais";

export default function NovaDividaModal({ divida, onClose }: { divida?: DividaPessoal; onClose: () => void }) {
  const [credor, setCredor] = useState(divida?.credor ?? "");
  const [descricao, setDescricao] = useState(divida?.descricao ?? "");
  const [saldoInicial, setSaldoInicial] = useState(String(divida?.saldo_inicial ?? ""));
  const [valorParcela, setValorParcela] = useState(divida?.valor_parcela != null ? String(divida.valor_parcela) : "");
  const [parcelasRestantes, setParcelasRestantes] = useState(
    divida?.parcelas_restantes_inicial != null ? String(divida.parcelas_restantes_inicial) : ""
  );
  const [diaVencimento, setDiaVencimento] = useState(divida?.dia_vencimento != null ? String(divida.dia_vencimento) : "");
  const [taxaJuros, setTaxaJuros] = useState(divida?.taxa_juros_mensal != null ? String(divida.taxa_juros_mensal) : "");
  const [observacoes, setObservacoes] = useState(divida?.observacoes ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!credor.trim()) {
      setError("Credor é obrigatório.");
      return;
    }
    const saldo = Number(saldoInicial.replace(",", "."));
    if (!saldo || saldo <= 0) {
      setError("Informe o saldo devedor atual (maior que zero).");
      return;
    }
    const input: DividaInput = {
      credor: credor.trim(),
      descricao: descricao.trim() || null,
      saldo_inicial: saldo,
      valor_parcela: valorParcela.trim() ? Number(valorParcela.replace(",", ".")) : null,
      parcelas_restantes_inicial: parcelasRestantes.trim() ? Number(parcelasRestantes) : null,
      dia_vencimento: diaVencimento.trim() ? Number(diaVencimento) : null,
      taxa_juros_mensal: taxaJuros.trim() ? Number(taxaJuros.replace(",", ".")) : null,
      observacoes: observacoes.trim() || null,
    };
    startTransition(async () => {
      const resultado = divida ? await updateDivida(divida.id, input) : await createDivida(input);
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
        <h2 className="mb-1 font-display text-lg font-bold">{divida ? "Editar Dívida" : "Nova Dívida"}</h2>
        <p className="mb-4 text-[12px] text-text-secondary">
          Só o saldo devedor atual e as parcelas que faltam — não precisa reconstruir o histórico todo.
        </p>

        <label className="mb-1 block text-xs text-text-secondary">Credor</label>
        <input
          value={credor}
          onChange={(e) => setCredor(e.target.value)}
          placeholder="Banco, financeira, pessoa..."
          className="mb-3 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
        />

        <label className="mb-1 block text-xs text-text-secondary">Descrição (opcional)</label>
        <input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className="mb-3 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
        />

        <label className="mb-1 block text-xs text-text-secondary">Saldo devedor atual</label>
        <input
          value={saldoInicial}
          onChange={(e) => setSaldoInicial(e.target.value)}
          inputMode="decimal"
          disabled={!!divida}
          className="mb-3 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm disabled:opacity-50"
        />
        {divida && <p className="-mt-2 mb-3 text-[11px] text-text-muted">O saldo muda pelos pagamentos registrados, não editando aqui.</p>}

        <div className="mb-3 flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Valor da parcela</label>
            <input
              value={valorParcela}
              onChange={(e) => setValorParcela(e.target.value)}
              inputMode="decimal"
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Parcelas restantes</label>
            <input
              value={parcelasRestantes}
              onChange={(e) => setParcelasRestantes(e.target.value)}
              inputMode="numeric"
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="mb-3 flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Dia do vencimento</label>
            <input
              value={diaVencimento}
              onChange={(e) => setDiaVencimento(e.target.value)}
              inputMode="numeric"
              placeholder="1-28"
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Juros ao mês (%, opcional)</label>
            <input
              value={taxaJuros}
              onChange={(e) => setTaxaJuros(e.target.value)}
              inputMode="decimal"
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            />
          </div>
        </div>

        <label className="mb-1 block text-xs text-text-secondary">Observações</label>
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={2}
          className="mb-4 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
        />

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
            {pending ? "Salvando..." : divida ? "Salvar" : "Criar Dívida"}
          </button>
        </div>
      </form>
    </div>
  );
}

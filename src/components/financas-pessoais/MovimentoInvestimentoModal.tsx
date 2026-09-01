"use client";

import { useState, useTransition } from "react";
import type { ContaPessoal, InvestimentoPessoal, TipoMovimentoInvestimento } from "@/lib/domain/types";
import { hojeISOOperacao } from "@/lib/domain/dates";
import { fmtBRL } from "@/lib/domain/types";
import { registrarMovimentoInvestimento } from "@/lib/actions/financasPessoais";

const TIPO_LABEL: Record<TipoMovimentoInvestimento, string> = {
  aporte: "Aporte",
  resgate: "Resgate",
  rendimento: "Rendimento",
};

export default function MovimentoInvestimentoModal({
  investimento,
  saldoAtual,
  contas,
  onClose,
}: {
  investimento: InvestimentoPessoal;
  saldoAtual: number;
  contas: ContaPessoal[];
  onClose: () => void;
}) {
  const [tipo, setTipo] = useState<TipoMovimentoInvestimento>("aporte");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hojeISOOperacao());
  const [contaId, setContaId] = useState<string>(contas[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const valorNum = Number(valor.replace(",", "."));
    if (!valorNum || valorNum <= 0) {
      setError("Informe um valor maior que zero.");
      return;
    }
    startTransition(async () => {
      const resultado = await registrarMovimentoInvestimento(investimento.id, tipo, {
        valor: valorNum,
        data,
        contaId: tipo === "rendimento" ? null : contaId || null,
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
        className="w-full max-w-sm rounded-card border border-border-gold bg-card p-6"
      >
        <h2 className="mb-1 font-display text-lg font-bold">Registrar movimento — {investimento.nome}</h2>
        <p className="mb-4 text-[12px] text-text-secondary">Saldo atual investido: {fmtBRL(saldoAtual)}</p>

        <div className="mb-3 flex gap-2">
          {(["aporte", "resgate", "rendimento"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className={`flex-1 rounded-btn border px-2 py-1.5 text-[12.5px] font-semibold ${
                tipo === t ? "border-gold text-gold" : "border-border-neutral text-text-secondary"
              }`}
            >
              {TIPO_LABEL[t]}
            </button>
          ))}
        </div>

        <label className="mb-1 block text-xs text-text-secondary">Valor</label>
        <input
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          inputMode="decimal"
          className="mb-3 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
        />

        <label className="mb-1 block text-xs text-text-secondary">Data</label>
        <input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="mb-3 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
        />

        {tipo !== "rendimento" && contas.length > 0 && (
          <>
            <label className="mb-1 block text-xs text-text-secondary">
              {tipo === "aporte" ? "Conta de onde saiu" : "Conta pra onde volta"}
            </label>
            <select
              value={contaId}
              onChange={(e) => setContaId(e.target.value)}
              className="mb-3 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            >
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </>
        )}
        {tipo === "rendimento" && (
          <p className="mb-3 text-[11.5px] text-text-muted">
            Rendimento fica dentro do investimento — não mexe em nenhuma conta até um resgate futuro.
          </p>
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
            {pending ? "Salvando..." : "Confirmar"}
          </button>
        </div>
      </form>
    </div>
  );
}

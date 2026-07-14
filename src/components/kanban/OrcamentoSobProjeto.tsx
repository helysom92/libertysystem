"use client";

import { useState, useTransition } from "react";
import { fmtBRL } from "@/lib/domain/types";
import { calcularFormulaPersonalizada } from "@/lib/domain/orcamento";
import { createItemOrcamento } from "@/lib/actions/itensOrcamento";
import { sugerirValorComIa } from "@/lib/actions/orcamento";
import type { ServicoTipo } from "@/lib/domain/flows";

/** Fórmula de referência (custo × 3 + 15%, nunca abaixo de custo × 3) para itens fora do catálogo. */
export default function OrcamentoSobProjeto({
  tipo,
  descricao,
  onAplicar,
}: {
  tipo: ServicoTipo;
  descricao: string;
  onAplicar: (valor: number) => void;
}) {
  const [custoDireto, setCustoDireto] = useState("");
  const [novoItemNome, setNovoItemNome] = useState("");
  const [salvandoCatalogo, setSalvandoCatalogo] = useState(false);
  const [sugestao, setSugestao] = useState<string | null>(null);
  const [pendingIa, startTransitionIa] = useTransition();

  const custo = Number(custoDireto) || 0;
  const { valorMinimo, valorReferencia } = calcularFormulaPersonalizada(custo);

  function pedirSugestaoIa() {
    setSugestao(null);
    startTransitionIa(async () => {
      const texto = await sugerirValorComIa({ tipo, descricao, valorCalculado: valorReferencia });
      setSugestao(texto);
    });
  }

  async function salvarNoCatalogo() {
    if (!novoItemNome) return;
    setSalvandoCatalogo(true);
    try {
      await createItemOrcamento({ nome: novoItemNome, tipo_cobranca: "fixo", preco: valorReferencia });
      setNovoItemNome("");
    } finally {
      setSalvandoCatalogo(false);
    }
  }

  return (
    <div className="mb-3 rounded-btn bg-card-secondary p-2.5">
      <label className="mb-1 block text-[10.5px] text-text-muted">Custo direto (material + terceiros)</label>
      <input
        type="number"
        step="0.01"
        value={custoDireto}
        onChange={(e) => setCustoDireto(e.target.value)}
        className="mb-2 w-full rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
      />

      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-[11px] text-text-muted">Mínimo (custo × 3): {fmtBRL(valorMinimo)}</p>
          <p className="font-display text-sm font-bold text-gradient-gold">
            {fmtBRL(valorReferencia)}{" "}
            <span className="text-[11px] font-normal text-text-muted">sugerido</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => onAplicar(Math.round(valorReferencia * 100) / 100)}
          disabled={custo <= 0}
          className="rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-3 py-1.5 text-[12.5px] font-semibold text-bg disabled:opacity-40"
        >
          Usar este valor
        </button>
      </div>

      {custo > 0 && (
        <div className="mb-1 flex gap-2">
          <input
            value={novoItemNome}
            onChange={(e) => setNovoItemNome(e.target.value)}
            placeholder="Nome p/ salvar no catálogo (opcional)"
            className="flex-1 rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-[12px]"
          />
          <button
            type="button"
            onClick={salvarNoCatalogo}
            disabled={!novoItemNome || salvandoCatalogo}
            className="shrink-0 rounded-btn border border-border-gold-strong px-2 py-1.5 text-[11px] text-gold disabled:opacity-40"
          >
            {salvandoCatalogo ? "Salvando..." : "+ Catálogo"}
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={pedirSugestaoIa}
        disabled={pendingIa || !descricao || custo <= 0}
        className="mt-2 w-fit text-[11.5px] text-text-secondary underline-offset-2 hover:text-gold hover:underline disabled:opacity-40"
      >
        {pendingIa ? "Consultando IA..." : "Comparar com serviços parecidos (IA)"}
      </button>
      {sugestao && (
        <p className="mt-2 rounded-btn bg-card px-2.5 py-2 text-[12px] text-text-secondary">
          {sugestao}
        </p>
      )}
    </div>
  );
}

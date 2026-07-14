"use client";

import { useState, useTransition } from "react";
import type { Material } from "@/lib/domain/types";
import { fmtBRL } from "@/lib/domain/types";
import { calcularOrcamento, type OrcamentoItem } from "@/lib/domain/orcamento";
import { sugerirValorComIa } from "@/lib/actions/orcamento";
import type { ServicoTipo } from "@/lib/domain/flows";

export default function CalculadoraOrcamento({
  materiais,
  tipo,
  descricao,
  onAplicar,
}: {
  materiais: Material[];
  tipo: ServicoTipo;
  descricao: string;
  onAplicar: (valor: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [materialId, setMaterialId] = useState(materiais[0]?.id ?? "");
  const [quantidade, setQuantidade] = useState("1");
  const [maoDeObraPct, setMaoDeObraPct] = useState("30");
  const [margemPct, setMargemPct] = useState("30");
  const [sugestao, setSugestao] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (materiais.length === 0) return null;

  const itens: OrcamentoItem[] = materialId
    ? [{ materialId, quantidade: Number(quantidade) || 0 }]
    : [];
  const resultado = calcularOrcamento(itens, materiais, Number(maoDeObraPct) || 0, Number(margemPct) || 0);

  function pedirSugestaoIa() {
    setSugestao(null);
    startTransition(async () => {
      const texto = await sugerirValorComIa({ tipo, descricao, valorCalculado: resultado.valorBase });
      setSugestao(texto);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-3 w-fit rounded-btn border border-border-gold-strong px-3 py-1.5 text-[12.5px] text-gold"
      >
        Calcular Orçamento
      </button>
    );
  }

  return (
    <div className="mb-3 rounded-card border border-border-gold-strong bg-card-secondary p-3">
      <p className="mb-2 text-[10.5px] tracking-wide text-text-muted uppercase">
        Calculadora de Orçamento
      </p>

      <div className="mb-2 flex gap-2">
        <select
          value={materialId}
          onChange={(e) => setMaterialId(e.target.value)}
          className="flex-1 rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
        >
          {materiais.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome} ({fmtBRL(m.preco_unitario)}/{m.unidade === "m2" ? "m²" : m.unidade === "metro_linear" ? "m" : "un"})
            </option>
          ))}
        </select>
        <input
          type="number"
          value={quantidade}
          onChange={(e) => setQuantidade(e.target.value)}
          placeholder="Qtd"
          className="w-24 rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
        />
      </div>

      <div className="mb-2 flex gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-[10.5px] text-text-muted">Mão de obra (%)</label>
          <input
            type="number"
            value={maoDeObraPct}
            onChange={(e) => setMaoDeObraPct(e.target.value)}
            className="w-full rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-[10.5px] text-text-muted">Margem (%)</label>
          <input
            type="number"
            value={margemPct}
            onChange={(e) => setMargemPct(e.target.value)}
            className="w-full rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-[11px] text-text-muted">Custo material: {fmtBRL(resultado.custoMaterial)}</p>
          <p className="font-display text-sm font-bold text-gradient-gold">
            {fmtBRL(resultado.valorBase)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onAplicar(Math.round(resultado.valorBase * 100) / 100)}
          className="rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-3 py-1.5 text-[12.5px] font-semibold text-bg"
        >
          Usar este valor
        </button>
      </div>

      <button
        type="button"
        onClick={pedirSugestaoIa}
        disabled={pending || !descricao}
        className="w-fit text-[11.5px] text-text-secondary underline-offset-2 hover:text-gold hover:underline disabled:opacity-40"
      >
        {pending ? "Consultando IA..." : "Comparar com serviços parecidos (IA)"}
      </button>
      {sugestao && (
        <p className="mt-2 rounded-btn bg-card px-2.5 py-2 text-[12px] text-text-secondary">
          {sugestao}
        </p>
      )}
    </div>
  );
}

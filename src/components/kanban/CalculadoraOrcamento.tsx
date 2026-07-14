"use client";

import { useState, useTransition } from "react";
import type { ItemOrcamento } from "@/lib/domain/types";
import { fmtBRL } from "@/lib/domain/types";
import {
  calcularFormulaPersonalizada,
  precoItemCatalogo,
  PEDIDO_MINIMO,
} from "@/lib/domain/orcamento";
import { createItemOrcamento } from "@/lib/actions/itensOrcamento";
import { sugerirValorComIa } from "@/lib/actions/orcamento";
import type { ServicoTipo } from "@/lib/domain/flows";

export default function CalculadoraOrcamento({
  itensOrcamento,
  tipo,
  descricao,
  onAplicar,
}: {
  itensOrcamento: ItemOrcamento[];
  tipo: ServicoTipo;
  descricao: string;
  onAplicar: (valor: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [modo, setModo] = useState<"catalogo" | "personalizado">("catalogo");

  // modo catálogo
  const [itemId, setItemId] = useState(itensOrcamento[0]?.id ?? "");
  const [largura, setLargura] = useState("1");
  const [altura, setAltura] = useState("1");

  // modo personalizado
  const [custoDireto, setCustoDireto] = useState("");
  const [novoItemNome, setNovoItemNome] = useState("");
  const [salvandoCatalogo, setSalvandoCatalogo] = useState(false);

  const [sugestao, setSugestao] = useState<string | null>(null);
  const [pendingIa, startTransitionIa] = useTransition();

  const item = itensOrcamento.find((i) => i.id === itemId) ?? null;
  const area = (Number(largura) || 0) * (Number(altura) || 0);
  const precoCatalogo = item ? precoItemCatalogo(item, area) : 0;

  const custo = Number(custoDireto) || 0;
  const { valorMinimo, valorReferencia } = calcularFormulaPersonalizada(custo);

  function pedirSugestaoIa(valorCalculado: number) {
    setSugestao(null);
    startTransitionIa(async () => {
      const texto = await sugerirValorComIa({ tipo, descricao, valorCalculado });
      setSugestao(texto);
    });
  }

  async function salvarNoCatalogo() {
    if (!novoItemNome) return;
    setSalvandoCatalogo(true);
    try {
      await createItemOrcamento({
        nome: novoItemNome,
        tipo_cobranca: "fixo",
        preco: valorReferencia,
      });
      setNovoItemNome("");
    } finally {
      setSalvandoCatalogo(false);
    }
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
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10.5px] tracking-wide text-text-muted uppercase">
          Calculadora de Orçamento
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setModo("catalogo")}
            className={`rounded-btn px-2 py-1 text-[11px] ${modo === "catalogo" ? "bg-card text-gold" : "text-text-secondary"}`}
          >
            Catálogo
          </button>
          <button
            type="button"
            onClick={() => setModo("personalizado")}
            className={`rounded-btn px-2 py-1 text-[11px] ${modo === "personalizado" ? "bg-card text-gold" : "text-text-secondary"}`}
          >
            Sob Projeto
          </button>
        </div>
      </div>

      {modo === "catalogo" ? (
        <>
          <select
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            className="mb-2 w-full rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
          >
            {itensOrcamento.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nome} {i.preco != null ? `(${fmtBRL(i.preco)}${i.tipo_cobranca === "m2" ? "/m²" : ""})` : "(sob projeto)"}
              </option>
            ))}
          </select>

          {item?.tipo_cobranca === "m2" && (
            <div className="mb-2 flex gap-2">
              <input
                type="number"
                step="0.01"
                value={largura}
                onChange={(e) => setLargura(e.target.value)}
                placeholder="Largura (m)"
                className="flex-1 rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
              />
              <input
                type="number"
                step="0.01"
                value={altura}
                onChange={(e) => setAltura(e.target.value)}
                placeholder="Altura (m)"
                className="flex-1 rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
              />
            </div>
          )}

          {item?.preco == null ? (
            <p className="text-[12px] text-text-muted">
              Este item é sob projeto — use a aba &quot;Sob Projeto&quot; para calcular.
            </p>
          ) : (
            <div className="mb-2 flex items-center justify-between">
              <div>
                {item.tipo_cobranca === "m2" && (
                  <p className="text-[11px] text-text-muted">
                    Área: {Math.max(area, 1).toFixed(2)} m² (mínimo 1 m²)
                  </p>
                )}
                <p className="font-display text-sm font-bold text-gradient-gold">
                  {fmtBRL(precoCatalogo)}
                </p>
                {precoCatalogo === PEDIDO_MINIMO && (
                  <p className="text-[11px] text-text-muted">Pedido mínimo aplicado (R$ 80)</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onAplicar(precoCatalogo)}
                className="rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-3 py-1.5 text-[12.5px] font-semibold text-bg"
              >
                Usar este valor
              </button>
            </div>
          )}
        </>
      ) : (
        <>
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
                {fmtBRL(valorReferencia)} <span className="text-[11px] font-normal text-text-muted">sugerido</span>
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
        </>
      )}

      <button
        type="button"
        onClick={() => pedirSugestaoIa(modo === "catalogo" ? precoCatalogo : valorReferencia)}
        disabled={pendingIa || !descricao}
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

"use client";

import { useState } from "react";
import {
  CATEGORIA_PRAZO_INFO,
  calcularItemOrcamento,
  type CategoriaPrazo,
  type ModoCalculoItem,
  type OrcamentoItemDraft,
} from "@/lib/domain/orcamento";
import { fmtBRL, type ItemOrcamento } from "@/lib/domain/types";

export interface ItemFormState extends OrcamentoItemDraft {
  descricao: string;
  valorOverride: number | null;
}

export function novoItemFormState(): ItemFormState {
  return {
    categoriaPrazo: "balcao",
    modoCalculo: "catalogo",
    itemOrcamentoId: null,
    larguraCm: 0,
    alturaCm: 0,
    quantidade: 1,
    custoDireto: 0,
    precoM2Manual: 0,
    descricao: "",
    valorOverride: null,
  };
}

export function valorFinalDoItem(item: ItemFormState, itensOrcamento: ItemOrcamento[]): number {
  if (item.valorOverride != null) return item.valorOverride;
  return calcularItemOrcamento(item, itensOrcamento).sugerido;
}

const CATEGORIAS: CategoriaPrazo[] = ["balcao", "simples", "complexo"];

export default function OrcamentoItemRow({
  index,
  item,
  itensOrcamento,
  onChange,
  onRemove,
}: {
  index: number;
  item: ItemFormState;
  itensOrcamento: ItemOrcamento[];
  onChange: (item: ItemFormState) => void;
  onRemove: () => void;
}) {
  const itemCatalogo = itensOrcamento.find((i) => i.id === item.itemOrcamentoId) ?? null;
  const calculo = calcularItemOrcamento(item, itensOrcamento);
  const valorFinal = item.valorOverride ?? calculo.sugerido;

  // Metragem é obrigatória pro cálculo em alguns modos; fora deles fica opcional, só pro
  // controle do usuário (não entra na conta). `mostrarMedidas` já cobre o caso obrigatório
  // sem precisar sincronizar `medidasOn` via effect.
  const medidasObrigatorias =
    (item.modoCalculo === "catalogo" && itemCatalogo?.tipo_cobranca === "m2") ||
    item.modoCalculo === "m2_manual";
  const [medidasOn, setMedidasOn] = useState(medidasObrigatorias);
  const mostrarMedidas = medidasOn || medidasObrigatorias;

  // Digitar o valor livremente sem o campo reformatar (e "brigar" com o cursor) a cada tecla.
  // Ajusta o texto exibido durante o render (não num effect) quando o sugerido muda por fora
  // e não há valor manual — padrão recomendado pra "adjusting state when a prop changes".
  const [valorTexto, setValorTexto] = useState(() => valorFinal.toFixed(2));
  const [sugeridoAnterior, setSugeridoAnterior] = useState(calculo.sugerido);
  if (item.valorOverride == null && calculo.sugerido !== sugeridoAnterior) {
    setSugeridoAnterior(calculo.sugerido);
    setValorTexto(calculo.sugerido.toFixed(2));
  }

  function set(patch: Partial<ItemFormState>) {
    onChange({ ...item, ...patch });
  }

  function setCategoriaPrazo(categoriaPrazo: CategoriaPrazo) {
    // Balcão sempre usa o catálogo; Simples/Complexo usam fórmula ou m² manual.
    const modoCalculo: ModoCalculoItem = categoriaPrazo === "balcao" ? "catalogo" : "formula";
    set({ categoriaPrazo, modoCalculo, valorOverride: null });
  }

  return (
    <div className="mb-3 rounded-card border border-border-neutral bg-card-secondary p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <strong className="text-[12.5px]">Item {index + 1}</strong>
        <div className="flex gap-1">
          {CATEGORIAS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategoriaPrazo(c)}
              className={`rounded-btn border px-2 py-1 text-[11px] ${
                item.categoriaPrazo === c
                  ? "border-gold bg-gold/10 text-gold"
                  : "border-border-neutral text-text-secondary"
              }`}
            >
              {CATEGORIA_PRAZO_INFO[c].prazoLabel}
            </button>
          ))}
        </div>
        <button type="button" onClick={onRemove} className="text-[11px] text-danger">
          Remover ✕
        </button>
      </div>

      <input
        value={item.descricao}
        onChange={(e) => set({ descricao: e.target.value })}
        placeholder="Descrição do item"
        className="mb-2 w-full rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
      />

      {item.categoriaPrazo === "balcao" ? (
        <>
          <select
            value={item.itemOrcamentoId ?? ""}
            onChange={(e) => {
              const selecionado = itensOrcamento.find((i) => i.id === e.target.value);
              set({
                itemOrcamentoId: e.target.value || null,
                descricao: item.descricao || selecionado?.nome || "",
              });
            }}
            className="mb-2 w-full rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
          >
            <option value="">— Selecione um material/produto —</option>
            {itensOrcamento.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nome} {i.preco != null ? `(${fmtBRL(i.preco)}${i.tipo_cobranca === "m2" ? "/m²" : ""})` : "(sob projeto)"}
              </option>
            ))}
          </select>

          <input
            type="number"
            step="1"
            min="1"
            value={item.quantidade}
            onChange={(e) => set({ quantidade: Number(e.target.value) || 0 })}
            placeholder="Quantidade"
            className="mb-2 w-24 rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
          />
        </>
      ) : (
        <>
          <div className="mb-2 flex gap-1">
            <button
              type="button"
              onClick={() => set({ modoCalculo: "formula", valorOverride: null })}
              className={`flex-1 rounded-btn border py-1.5 text-[11.5px] ${
                item.modoCalculo === "formula"
                  ? "border-gold bg-gold/10 text-gold"
                  : "border-border-neutral text-text-secondary"
              }`}
            >
              Por custo (× 3 + 15%)
            </button>
            <button
              type="button"
              onClick={() => set({ modoCalculo: "m2_manual", valorOverride: null })}
              className={`flex-1 rounded-btn border py-1.5 text-[11.5px] ${
                item.modoCalculo === "m2_manual"
                  ? "border-gold bg-gold/10 text-gold"
                  : "border-border-neutral text-text-secondary"
              }`}
            >
              Por m² (preço manual)
            </button>
          </div>

          {item.modoCalculo === "m2_manual" ? (
            <div className="mb-2 flex gap-2">
              <input
                type="number"
                step="0.01"
                value={item.precoM2Manual || ""}
                onChange={(e) => set({ precoM2Manual: Number(e.target.value) || 0 })}
                placeholder="Preço/m² (R$)"
                className="flex-1 rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
              />
              <input
                type="number"
                step="1"
                min="1"
                value={item.quantidade}
                onChange={(e) => set({ quantidade: Number(e.target.value) || 0 })}
                placeholder="Qtd"
                className="w-20 rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
              />
            </div>
          ) : (
            <div className="mb-2 flex gap-2">
              <input
                type="number"
                step="0.01"
                value={item.custoDireto || ""}
                onChange={(e) => set({ custoDireto: Number(e.target.value) || 0 })}
                placeholder="Custo direto (R$)"
                className="flex-1 rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
              />
              <input
                type="number"
                step="1"
                min="1"
                value={item.quantidade}
                onChange={(e) => set({ quantidade: Number(e.target.value) || 0 })}
                placeholder="Qtd"
                className="w-20 rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
              />
            </div>
          )}
        </>
      )}

      <div className="mb-2">
        <label className="mb-1 flex items-center gap-1.5 text-[11px] text-text-secondary">
          <input
            type="checkbox"
            checked={mostrarMedidas}
            disabled={medidasObrigatorias}
            onChange={(e) => setMedidasOn(e.target.checked)}
          />
          Registrar metragem (largura × altura)
          {medidasObrigatorias && " · necessário pro cálculo"}
        </label>
        {mostrarMedidas && (
          <div className="flex gap-2">
            <input
              type="number"
              step="1"
              value={item.larguraCm || ""}
              onChange={(e) => set({ larguraCm: Number(e.target.value) || 0 })}
              placeholder="Largura (cm)"
              className="flex-1 rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
            />
            <input
              type="number"
              step="1"
              value={item.alturaCm || ""}
              onChange={(e) => set({ alturaCm: Number(e.target.value) || 0 })}
              placeholder="Altura (cm)"
              className="flex-1 rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border-neutral pt-2">
        <div className="text-[11px] text-text-muted">
          {calculo.area != null && <>Área: {calculo.area.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} m² · </>}
          Sugerido: <b className="text-text">{fmtBRL(calculo.sugerido)}</b>
          {calculo.minimoAplicado && <span className="ml-1 text-gold">(pedido mínimo aplicado)</span>}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-end gap-2">
        <label className="text-[11px] text-text-secondary">Valor final:</label>
        <input
          type="text"
          inputMode="decimal"
          value={valorTexto}
          onChange={(e) => {
            const raw = e.target.value;
            setValorTexto(raw);
            const parsed = Number(raw.replace(",", "."));
            if (!Number.isNaN(parsed)) set({ valorOverride: parsed });
          }}
          onBlur={() => setValorTexto((item.valorOverride ?? calculo.sugerido).toFixed(2))}
          className="w-32 rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-right text-sm font-semibold"
        />
        <button
          type="button"
          onClick={() => {
            set({ valorOverride: null });
            setValorTexto(calculo.sugerido.toFixed(2));
          }}
          className="rounded-btn border border-border-neutral px-2 py-1.5 text-[11px] text-text-secondary"
        >
          usar sugerido
        </button>
      </div>
    </div>
  );
}

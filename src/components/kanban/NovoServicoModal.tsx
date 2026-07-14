"use client";

import { useState, useTransition } from "react";
import { createServico } from "@/lib/actions/servicos";
import { TIPO_LABELS, type ServicoTipo } from "@/lib/domain/flows";
import type { Cliente, ItemOrcamento } from "@/lib/domain/types";
import { fmtBRL } from "@/lib/domain/types";
import { precoItemCatalogo, PEDIDO_MINIMO } from "@/lib/domain/orcamento";
import ClienteAutocomplete from "./ClienteAutocomplete";
import OrcamentoSobProjeto from "./OrcamentoSobProjeto";

export default function NovoServicoModal({
  clientes,
  itensOrcamento,
  onClose,
}: {
  clientes: Cliente[];
  itensOrcamento: ItemOrcamento[];
  onClose: () => void;
}) {
  const [cliente, setCliente] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [prazo, setPrazo] = useState("");
  const [tipo, setTipo] = useState<ServicoTipo>("simples");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Serviço (catálogo) — sempre visível, calcula e preenche o valor automaticamente.
  const [itemId, setItemId] = useState("");
  const [largura, setLargura] = useState("");
  const [altura, setAltura] = useState("");

  const item = itensOrcamento.find((i) => i.id === itemId) ?? null;
  const area = (Number(largura) || 0) * (Number(altura) || 0);
  const precoCatalogo = item && item.preco != null ? precoItemCatalogo(item, area) : null;

  function selecionarItem(id: string) {
    setItemId(id);
    const selecionado = itensOrcamento.find((i) => i.id === id);
    if (selecionado && selecionado.preco != null && selecionado.tipo_cobranca === "fixo") {
      setValor(String(selecionado.preco));
    }
    if (!descricao && selecionado) setDescricao(selecionado.nome);
  }

  function aplicarPrecoM2() {
    if (precoCatalogo != null) setValor(String(precoCatalogo));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!cliente || !descricao) {
      setError("Cliente e descrição são obrigatórios.");
      return;
    }
    startTransition(async () => {
      try {
        await createServico({
          cliente,
          descricao,
          valor: Number(valor) || 0,
          prazo: prazo || null,
          tipo,
        });
        onClose();
      } catch {
        setError("Não foi possível criar o serviço.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <form
        onSubmit={submit}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-card border border-border-gold bg-card p-6"
      >
        <h2 className="mb-4 font-display text-lg font-bold">Novo Serviço</h2>

        <label className="mb-1 block text-xs text-text-secondary">Tipo de serviço</label>
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as ServicoTipo)}
          className="mb-3 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
        >
          {Object.entries(TIPO_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <label className="mb-1 block text-xs text-text-secondary">Cliente</label>
        <div className="mb-3">
          <ClienteAutocomplete clientes={clientes} value={cliente} onChange={setCliente} />
        </div>

        <label className="mb-1 block text-xs text-text-secondary">Descrição</label>
        <input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className="mb-3 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
        />

        <label className="mb-1 block text-xs text-text-secondary">Serviço (catálogo de preços)</label>
        <select
          value={itemId}
          onChange={(e) => selecionarItem(e.target.value)}
          className="mb-2 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
        >
          <option value="">— Nenhum (preencher valor manualmente) —</option>
          {itensOrcamento.map((i) => (
            <option key={i.id} value={i.id}>
              {i.nome}
              {i.preco != null
                ? ` (${fmtBRL(i.preco)}${i.tipo_cobranca === "m2" ? "/m²" : ""})`
                : " (sob projeto)"}
            </option>
          ))}
        </select>

        {item && item.tipo_cobranca === "m2" && item.preco != null && (
          <div className="mb-3 rounded-btn bg-card-secondary p-2.5">
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
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] text-text-muted">Área: {Math.max(area, 1).toFixed(2)} m² (mín. 1 m²)</p>
                <p className="font-display text-sm font-bold text-gradient-gold">
                  {precoCatalogo != null ? fmtBRL(precoCatalogo) : "—"}
                </p>
                {precoCatalogo === PEDIDO_MINIMO && (
                  <p className="text-[11px] text-text-muted">Pedido mínimo aplicado (R$ 80)</p>
                )}
              </div>
              <button
                type="button"
                onClick={aplicarPrecoM2}
                className="rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-3 py-1.5 text-[12.5px] font-semibold text-bg"
              >
                Usar este valor
              </button>
            </div>
          </div>
        )}

        {item && item.preco == null && (
          <p className="mb-3 text-[11.5px] text-text-muted">
            Esse item é sob projeto — use &quot;Serviço específico&quot; abaixo para calcular.
          </p>
        )}

        <OrcamentoSobProjeto tipo={tipo} descricao={descricao} onAplicar={(v) => setValor(String(v))} />

        <div className="mb-3 flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Valor estimado</label>
            <input
              type="number"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Prazo</label>
            <input
              type="date"
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            />
          </div>
        </div>

        {error && <p className="mb-3 text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-btn px-4 py-2 text-sm text-text-secondary hover:text-text"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-4 py-2 text-sm font-semibold text-bg disabled:opacity-60"
          >
            {pending ? "Criando..." : "Criar Serviço"}
          </button>
        </div>
      </form>
    </div>
  );
}

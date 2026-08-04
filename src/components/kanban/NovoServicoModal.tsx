"use client";

import { useMemo, useState, useTransition } from "react";
import { createServico } from "@/lib/actions/servicos";
import { createOrcamentoItens } from "@/lib/actions/orcamentoItens";
import { TIPO_LABELS, type ServicoTipo } from "@/lib/domain/flows";
import type { Cliente, ItemOrcamento } from "@/lib/domain/types";
import { fmtBRL } from "@/lib/domain/types";
import { CATEGORIA_PRAZO_INFO, calcularItemOrcamento } from "@/lib/domain/orcamento";
import { buildOrcamentoText, type OrcamentoTextItem } from "@/lib/domain/orcamentoText";
import ClienteAutocomplete from "./ClienteAutocomplete";
import OrcamentoItemRow, { novoItemFormState, valorFinalDoItem, type ItemFormState } from "./OrcamentoItemRow";

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
  const [prazo, setPrazo] = useState("");
  const [tipo, setTipo] = useState<ServicoTipo>("simples");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [itens, setItens] = useState<ItemFormState[]>([novoItemFormState()]);

  const [local, setLocal] = useState("");
  const [validadeDias, setValidadeDias] = useState("7");
  const [condEntrada, setCondEntrada] = useState(false);
  const [condCartao, setCondCartao] = useState(false);
  const [condDesconto, setCondDesconto] = useState(false);
  const [observacoes, setObservacoes] = useState("");
  const [copiado, setCopiado] = useState(false);

  const clienteRecord = clientes.find((c) => c.nome.toLowerCase() === cliente.toLowerCase()) ?? null;

  const total = useMemo(
    () => itens.reduce((sum, item) => sum + valorFinalDoItem(item, itensOrcamento), 0),
    [itens, itensOrcamento]
  );

  const maxRank = useMemo(
    () => itens.reduce((max, item) => Math.max(max, CATEGORIA_PRAZO_INFO[item.categoriaPrazo].rank), 0),
    [itens]
  );
  const prazoEstimadoLabel = Object.values(CATEGORIA_PRAZO_INFO).find((c) => c.rank === maxRank)?.prazoLabel;

  function addItem() {
    setItens((prev) => [...prev, novoItemFormState()]);
  }

  function updateItem(index: number, next: ItemFormState) {
    setItens((prev) => prev.map((it, i) => (i === index ? next : it)));
  }

  function removeItem(index: number) {
    setItens((prev) => prev.filter((_, i) => i !== index));
  }

  async function copiarOrcamento() {
    const textItens: OrcamentoTextItem[] = itens.map((item) => {
      const calc = calcularItemOrcamento(item, itensOrcamento);
      const itemCatalogo = itensOrcamento.find((i) => i.id === item.itemOrcamentoId);
      return {
        descricao: item.descricao,
        categoriaPrazo: item.categoriaPrazo,
        modoCalculo: item.modoCalculo,
        itemNome: itemCatalogo?.nome,
        larguraCm: item.larguraCm,
        alturaCm: item.alturaCm,
        quantidade: item.quantidade,
        area: calc.area,
        unit: calc.unit,
        minimoAplicado: calc.minimoAplicado,
        valorFinal: valorFinalDoItem(item, itensOrcamento),
      };
    });

    const texto = buildOrcamentoText(textItens, {
      clienteNome: cliente,
      clienteTelefone: clienteRecord?.whatsapp,
      local: local || clienteRecord?.endereco,
      validadeDias: Number(validadeDias) || 7,
      condicoes: { entrada50: condEntrada, cartao: condCartao, desconto: condDesconto },
      observacoes,
    });

    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      // best-effort
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
    const digits = (clienteRecord?.whatsapp ?? "").replace(/\D/g, "");
    window.open(`https://wa.me/55${digits}?text=${encodeURIComponent(texto)}`, "_blank");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!cliente || !descricao) {
      setError("Cliente e descrição são obrigatórios.");
      return;
    }
    startTransition(async () => {
      try {
        const servicoId = await createServico({
          cliente,
          descricao,
          valor: total,
          prazo: prazo || null,
          tipo,
        });
        await createOrcamentoItens(
          servicoId,
          itens.map((item, ordem) => ({
            ordem,
            descricao: item.descricao,
            categoriaPrazo: item.categoriaPrazo,
            modoCalculo: item.modoCalculo,
            itemOrcamentoId: item.itemOrcamentoId,
            larguraCm: item.larguraCm || null,
            alturaCm: item.alturaCm || null,
            quantidade: item.quantidade,
            custoDireto: item.custoDireto || null,
            precoM2Manual: item.precoM2Manual || null,
            valorFinal: valorFinalDoItem(item, itensOrcamento),
          }))
        );
        onClose();
      } catch {
        setError("Não foi possível criar o serviço.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8">
      <form
        onSubmit={submit}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-card border border-border-gold bg-card p-6"
      >
        <h2 className="mb-4 font-display text-lg font-bold">Novo Orçamento / Serviço</h2>

        <label className="mb-1 block text-xs text-text-secondary">Tipo de serviço (fluxo)</label>
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

        <label className="mb-1 block text-xs text-text-secondary">Descrição geral</label>
        <input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className="mb-3 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
        />

        <p className="mb-2 text-[10.5px] tracking-wide text-text-muted uppercase">Itens do orçamento</p>
        {itens.map((item, index) => (
          <OrcamentoItemRow
            key={index}
            index={index}
            item={item}
            itensOrcamento={itensOrcamento}
            onChange={(next) => updateItem(index, next)}
            onRemove={() => removeItem(index)}
          />
        ))}
        <button
          type="button"
          onClick={addItem}
          className="mb-4 w-fit rounded-btn border border-border-gold-strong px-3 py-1.5 text-[12.5px] text-gold"
        >
          + Adicionar item
        </button>

        <div className="mb-4 flex items-center justify-between rounded-card bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-4 py-3">
          <span className="text-[13px] font-semibold text-bg">Total do orçamento</span>
          <span className="font-display text-lg font-bold text-bg">{fmtBRL(total)}</span>
        </div>
        {prazoEstimadoLabel && (
          <p className="mb-3 text-[11.5px] text-text-muted">
            Prazo estimado de entrega: {prazoEstimadoLabel}
          </p>
        )}

        <div className="mb-3 flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Local de instalação/entrega (opcional)</label>
            <input
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              placeholder={clienteRecord?.endereco ?? ""}
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            />
          </div>
          <div className="w-32">
            <label className="mb-1 block text-xs text-text-secondary">Validade (dias)</label>
            <input
              type="number"
              value={validadeDias}
              onChange={(e) => setValidadeDias(e.target.value)}
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="mb-3 flex flex-col gap-1.5 text-[12.5px]">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={condEntrada} onChange={(e) => setCondEntrada(e.target.checked)} />
            50% na entrada e 50% do valor na entrega do serviço
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={condCartao} onChange={(e) => setCondCartao(e.target.checked)} />
            Parcelamos no cartão, consulte as condições
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={condDesconto} onChange={(e) => setCondDesconto(e.target.checked)} />
            Desconto especial à vista, no Pix ou dinheiro
          </label>
        </div>

        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Outras observações (opcional)..."
          rows={2}
          className="mb-3 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
        />

        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            onClick={copiarOrcamento}
            disabled={!cliente || itens.length === 0}
            className="rounded-btn border border-border-neutral px-3 py-1.5 text-[12.5px] disabled:opacity-40"
            style={{ color: "#25D366" }}
          >
            📋 Copiar Orçamento
          </button>
          {copiado && <span className="text-[11.5px] text-success">Copiado!</span>}
        </div>

        <div className="mb-3 flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Prazo (data)</label>
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

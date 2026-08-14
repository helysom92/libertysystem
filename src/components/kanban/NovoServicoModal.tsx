"use client";

import { useMemo, useState, useTransition } from "react";
import { createServico } from "@/lib/actions/servicos";
import { createOrcamentoItens } from "@/lib/actions/orcamentoItens";
import { TIPO_LABELS, type ServicoTipo } from "@/lib/domain/flows";
import type { Cliente, ItemOrcamento } from "@/lib/domain/types";
import { fmtBRL } from "@/lib/domain/types";
import { LINHA_ORCAMENTO_INFO, prazoEstimadoLabel, type LinhaOrcamento } from "@/lib/domain/orcamento";
import { formatarWhatsapp } from "@/lib/domain/telefone";
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
  const [clienteWhatsapp, setClienteWhatsapp] = useState("");
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

  const [linha, setLinha] = useState<LinhaOrcamento | null>(null);
  const [formaPagamento, setFormaPagamento] = useState("");
  const [formaPagamentoDirty, setFormaPagamentoDirty] = useState(false);
  const [durabilidade, setDurabilidade] = useState("");

  const clienteRecord = clientes.find((c) => c.nome.toLowerCase() === cliente.toLowerCase()) ?? null;

  // Ao selecionar (ou trocar) um cliente com WhatsApp já cadastrado, preenche o campo de
  // verdade — antes ele só aparecia como texto fantasma (placeholder), sem valor real, então
  // dava pra confundir "tá vazio" com "já tem, só não mostrou". Feito no próprio handler de
  // mudança (não em efeito) pra não disparar um segundo render em cascata.
  const [lastClienteId, setLastClienteId] = useState<string | null>(null);
  function handleClienteChange(nome: string) {
    setCliente(nome);
    const record = clientes.find((c) => c.nome.toLowerCase() === nome.toLowerCase()) ?? null;
    const id = record?.id ?? null;
    if (id !== lastClienteId) {
      setLastClienteId(id);
      setClienteWhatsapp(record?.whatsapp ?? "");
    }
  }

  const total = useMemo(
    () => itens.reduce((sum, item) => sum + valorFinalDoItem(item, itensOrcamento), 0),
    [itens, itensOrcamento]
  );

  const prazoLabel = useMemo(
    () => prazoEstimadoLabel(itens.map((i) => i.categoriaPrazo)),
    [itens]
  );

  function composeFormaPagamento(flags: { entrada: boolean; cartao: boolean; desconto: boolean }) {
    const parts: string[] = [];
    if (flags.entrada) parts.push("50% na entrada e 50% do valor na entrega do serviço.");
    if (flags.cartao) parts.push("Parcelamos no cartão, consulte as condições.");
    if (flags.desconto) parts.push("Desconto especial à vista, no Pix ou dinheiro.");
    return parts.join(" ");
  }

  function onToggleCond(which: "entrada" | "cartao" | "desconto", value: boolean) {
    const flags = {
      entrada: which === "entrada" ? value : condEntrada,
      cartao: which === "cartao" ? value : condCartao,
      desconto: which === "desconto" ? value : condDesconto,
    };
    if (which === "entrada") setCondEntrada(value);
    if (which === "cartao") setCondCartao(value);
    if (which === "desconto") setCondDesconto(value);
    if (!formaPagamentoDirty) setFormaPagamento(composeFormaPagamento(flags));
  }

  function addItem() {
    setItens((prev) => [...prev, novoItemFormState()]);
  }

  function updateItem(index: number, next: ItemFormState) {
    setItens((prev) => prev.map((it, i) => (i === index ? next : it)));
  }

  function removeItem(index: number) {
    setItens((prev) => prev.filter((_, i) => i !== index));
  }

  const whatsappCliente = clienteWhatsapp || clienteRecord?.whatsapp || "";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!cliente || !whatsappCliente) {
      setError("Cliente e WhatsApp são obrigatórios.");
      return;
    }
    startTransition(async () => {
      try {
        const servicoId = await createServico({
          cliente,
          clienteWhatsapp: whatsappCliente || null,
          descricao,
          valor: total,
          prazo: prazo || null,
          tipo,
          linha_orcamento: linha,
          validade_proposta_dias: Number(validadeDias) || 7,
          forma_pagamento_texto: formaPagamento || null,
          durabilidade_texto: durabilidade || null,
          local_instalacao: local || null,
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
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

        <div className="mb-3 flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Cliente</label>
            <ClienteAutocomplete clientes={clientes} value={cliente} onChange={handleClienteChange} />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">WhatsApp do cliente</label>
            <input
              value={clienteWhatsapp}
              onChange={(e) => setClienteWhatsapp(e.target.value)}
              onBlur={(e) => setClienteWhatsapp(formatarWhatsapp(e.target.value))}
              placeholder="(67) 9XXXX-XXXX"
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            />
          </div>
        </div>
        {!clienteRecord && cliente && (
          <p className="-mt-2 mb-3 text-[11px] text-text-muted">
            Cliente novo — vai entrar como pré-cadastro até ter WhatsApp.
          </p>
        )}
        {clienteRecord && !clienteWhatsapp && (
          <p className="-mt-2 mb-3 text-[11px] text-gold">
            Esse cliente ainda não tem WhatsApp cadastrado — preencha acima pra continuar.
          </p>
        )}

        <label className="mb-1 block text-xs text-text-secondary">Descrição geral (opcional)</label>
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
        {prazoLabel && (
          <p className="mb-3 text-[11.5px] text-text-muted">
            Prazo estimado de entrega: {prazoLabel}
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
            <input
              type="checkbox"
              checked={condEntrada}
              onChange={(e) => onToggleCond("entrada", e.target.checked)}
            />
            50% na entrada e 50% do valor na entrega do serviço
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={condCartao}
              onChange={(e) => onToggleCond("cartao", e.target.checked)}
            />
            Parcelamos no cartão, consulte as condições
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={condDesconto}
              onChange={(e) => onToggleCond("desconto", e.target.checked)}
            />
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

        <p className="mb-2 text-[10.5px] tracking-wide text-text-muted uppercase">
          Documento da proposta (opcional)
        </p>
        <p className="mb-1.5 text-xs text-text-secondary">
          Linha comercial (opcional — clique de novo pra remover)
        </p>
        <div className="mb-3 flex gap-1">
          {(Object.keys(LINHA_ORCAMENTO_INFO) as LinhaOrcamento[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLinha((prev) => (prev === l ? null : l))}
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
        <label className="mb-1 block text-xs text-text-secondary">
          Forma de pagamento (documento)
        </label>
        <textarea
          value={formaPagamento}
          onChange={(e) => {
            setFormaPagamento(e.target.value);
            setFormaPagamentoDirty(true);
          }}
          rows={2}
          placeholder="A combinar"
          className="mb-3 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
        />
        <label className="mb-1 block text-xs text-text-secondary">
          Durabilidade estimada (opcional)
        </label>
        <input
          value={durabilidade}
          onChange={(e) => setDurabilidade(e.target.value)}
          placeholder="Ex: 2 a 5 anos, pintura sem desbotar"
          className="mb-3 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
        />

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
            {pending ? "Concluindo..." : "Concluir Orçamento"}
          </button>
        </div>
      </form>
    </div>
  );
}

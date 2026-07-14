"use client";

import { useState, useTransition } from "react";
import { createServico } from "@/lib/actions/servicos";
import { TIPO_LABELS, type ServicoTipo } from "@/lib/domain/flows";
import type { Material } from "@/lib/domain/types";
import CalculadoraOrcamento from "./CalculadoraOrcamento";

export default function NovoServicoModal({
  materiais,
  onClose,
}: {
  materiais: Material[];
  onClose: () => void;
}) {
  const [cliente, setCliente] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [prazo, setPrazo] = useState("");
  const [tipo, setTipo] = useState<ServicoTipo>("simples");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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
        className="w-full max-w-md rounded-card border border-border-gold bg-card p-6"
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
        <input
          value={cliente}
          onChange={(e) => setCliente(e.target.value)}
          placeholder="Nome do cliente"
          className="mb-3 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
        />

        <label className="mb-1 block text-xs text-text-secondary">Descrição</label>
        <input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className="mb-3 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
        />

        <CalculadoraOrcamento
          materiais={materiais}
          tipo={tipo}
          descricao={descricao}
          onAplicar={(v) => setValor(String(v))}
        />

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

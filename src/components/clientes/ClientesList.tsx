"use client";

import { useMemo, useState } from "react";
import type { Cliente, ClienteStatus, Servico } from "@/lib/domain/types";
import { fmtBRL } from "@/lib/domain/types";
import { computeClienteStats } from "@/lib/domain/clientes";
import NovoClienteModal from "./NovoClienteModal";
import ClienteEditModal from "./ClienteEditModal";

const TABS: { id: ClienteStatus | "todos"; label: string }[] = [
  { id: "pre_cadastro", label: "Pré-Cadastro" },
  { id: "regularizado", label: "Regularizados" },
  { id: "inativo", label: "Inativos" },
  { id: "todos", label: "Todos" },
];

export default function ClientesList({
  clientes,
  servicos,
  onChanged,
}: {
  clientes: Cliente[];
  servicos: Servico[];
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<ClienteStatus | "todos">("regularizado");
  const [busca, setBusca] = useState("");
  const [novoOpen, setNovoOpen] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);

  const filtered = useMemo(() => {
    return clientes.filter((c) => {
      if (tab !== "todos" && c.status !== tab) return false;
      if (busca && !c.nome.toLowerCase().includes(busca.toLowerCase())) return false;
      return true;
    });
  }, [clientes, tab, busca]);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display text-xl font-bold">Clientes</h1>
          <p className="text-[13px] text-text-secondary">Cadastro de clientes</p>
        </div>
        <button
          type="button"
          onClick={() => setNovoOpen(true)}
          className="rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-4 py-2 text-sm font-semibold text-bg"
        >
          + Novo Cliente
        </button>
      </div>

      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-btn px-3 py-1.5 text-[12.5px] ${
                tab === t.id ? "bg-card font-semibold text-gold" : "text-text-secondary hover:bg-card"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome..."
          className="w-64 rounded-btn border border-border-neutral bg-card-secondary px-3 py-1.5 text-sm"
        />
      </div>

      <div className="overflow-x-auto rounded-card border border-border-neutral">
        <table className="w-full text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-border-neutral text-[10.5px] tracking-wide text-text-muted uppercase">
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Empresa</th>
              <th className="px-3 py-2">CNPJ/CPF</th>
              <th className="px-3 py-2">Telefone</th>
              <th className="px-3 py-2">Serviços</th>
              <th className="px-3 py-2">Total Comprado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const stats = computeClienteStats(c.id, servicos);
              return (
                <tr
                  key={c.id}
                  onClick={() => setEditing(c)}
                  className="cursor-pointer border-b border-border-neutral bg-card hover:bg-card-secondary"
                >
                  <td className="px-3 py-2 font-semibold">{c.nome}</td>
                  <td className="px-3 py-2 text-text-secondary">{c.empresa || "—"}</td>
                  <td className="px-3 py-2 text-text-secondary">{c.cpf_cnpj || "—"}</td>
                  <td className="px-3 py-2 text-text-secondary">{c.whatsapp || "—"}</td>
                  <td className="px-3 py-2">{stats.servicosVinculados}</td>
                  <td className="px-3 py-2 font-semibold text-gradient-gold">
                    {fmtBRL(stats.totalComprado)}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-text-muted">
                  Nenhum cliente encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {novoOpen && (
        <NovoClienteModal
          onClose={() => {
            setNovoOpen(false);
            onChanged();
          }}
        />
      )}
      {editing && (
        <ClienteEditModal cliente={editing} onClose={() => setEditing(null)} onChanged={onChanged} />
      )}
    </div>
  );
}

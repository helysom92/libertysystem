"use client";

import { useState } from "react";
import type { Cliente, ClienteStatus } from "@/lib/domain/types";
import { updateClienteInline } from "@/lib/actions/servicos";
import { updateClienteStatus } from "@/lib/actions/clientes";

const FIELDS: { key: keyof Cliente; label: string }[] = [
  { key: "nome", label: "Nome" },
  { key: "empresa", label: "Empresa" },
  { key: "whatsapp", label: "Telefone / WhatsApp" },
  { key: "cpf_cnpj", label: "CPF/CNPJ" },
  { key: "cidade", label: "Cidade" },
  { key: "endereco", label: "Endereço" },
  { key: "observacoes", label: "Observações" },
];

const STATUS_LABELS: Record<ClienteStatus, string> = {
  pre_cadastro: "Pré-Cadastro",
  regularizado: "Regularizado",
  inativo: "Inativo",
};

export default function ClienteEditModal({
  cliente,
  onClose,
  onChanged,
}: {
  cliente: Cliente;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [values, setValues] = useState(cliente);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const { id, created_at, status, ...fields } = values;
      void id;
      void created_at;
      await updateClienteInline(cliente.id, fields);
      if (status !== cliente.status) {
        await updateClienteStatus(cliente.id, status);
      }
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-lg rounded-card border border-border-gold bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">{cliente.nome}</h2>
          <button type="button" onClick={onClose} className="text-text-secondary hover:text-text">
            ✕
          </button>
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-[10.5px] tracking-wide text-text-muted uppercase">
            Status
          </label>
          <select
            value={values.status}
            onChange={(e) => setValues((v) => ({ ...v, status: e.target.value as ClienteStatus }))}
            className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
          >
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {FIELDS.map(({ key, label }) => (
            <div key={key} className={key === "observacoes" ? "col-span-2" : ""}>
              <label className="mb-1 block text-[10.5px] tracking-wide text-text-muted uppercase">
                {label}
              </label>
              <input
                value={values[key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
              />
            </div>
          ))}
        </div>

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-btn px-4 py-2 text-sm text-text-secondary hover:text-text"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-4 py-2 text-sm font-semibold text-bg disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

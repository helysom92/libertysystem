"use client";

import { useState } from "react";
import type { Cliente, ClienteStatus } from "@/lib/domain/types";
import { updateClienteInline } from "@/lib/actions/servicos";
import { deleteCliente, updateClienteStatus } from "@/lib/actions/clientes";

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
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!values.nome || !values.whatsapp) {
      setError("Nome e WhatsApp são obrigatórios.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Lista explícita, não "resto do objeto" — `values` vem de um `select("*")` que também
      // traz `nome_lower` (coluna gerada pelo Postgres a partir de `nome`, só pra evitar nomes
      // duplicados); mandar ela de volta no UPDATE quebra com "generated column" no Postgres.
      await updateClienteInline(cliente.id, {
        nome: values.nome,
        empresa: values.empresa,
        cpf_cnpj: values.cpf_cnpj,
        cidade: values.cidade,
        endereco: values.endereco,
        whatsapp: values.whatsapp,
        observacoes: values.observacoes,
      });
      if (values.status !== cliente.status) {
        await updateClienteStatus(cliente.id, values.status);
      }
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Excluir o cliente "${cliente.nome}"? Essa ação não pode ser desfeita.`)) return;
    setDeleting(true);
    setError(null);
    try {
      const result = await deleteCliente(cliente.id);
      if (!result.ok) {
        setError(result.reason ?? "Não foi possível excluir esse cliente.");
        return;
      }
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido ao excluir.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-card border border-border-gold bg-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-btn border border-danger-border px-4 py-2 text-sm text-danger disabled:opacity-60"
          >
            {deleting ? "Excluindo..." : "Excluir Cliente"}
          </button>
          <div className="flex gap-2">
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
    </div>
  );
}

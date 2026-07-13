"use client";

import { useState } from "react";
import type { ServicoDetail } from "@/lib/domain/types";
import { updateClienteInline } from "@/lib/actions/servicos";

const FIELDS: { key: keyof ServicoDetail["cliente"]; label: string }[] = [
  { key: "nome", label: "Nome" },
  { key: "empresa", label: "Empresa" },
  { key: "whatsapp", label: "Telefone / WhatsApp" },
  { key: "cpf_cnpj", label: "CPF/CNPJ" },
  { key: "cidade", label: "Cidade" },
  { key: "endereco", label: "Endereço" },
  { key: "observacoes", label: "Observações" },
];

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export default function ClienteTab({
  detail,
  onChanged,
}: {
  detail: ServicoDetail;
  onChanged: () => void;
}) {
  const { cliente } = detail;
  const [values, setValues] = useState(cliente);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function handleChange(key: keyof ServicoDetail["cliente"], value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    setSaveState("dirty");
  }

  async function handleSave() {
    setSaveState("saving");
    setErrorMsg(null);
    try {
      const { id, created_at, ...fields } = values;
      void id;
      void created_at;
      await updateClienteInline(cliente.id, fields);
      setSaveState("saved");
      onChanged();
    } catch (err) {
      setSaveState("error");
      setErrorMsg(err instanceof Error ? err.message : "Erro desconhecido ao salvar.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        {FIELDS.map(({ key, label }) => (
          <div key={key} className={key === "observacoes" ? "col-span-2" : ""}>
            <label className="mb-1 block text-[10.5px] tracking-wide text-text-muted uppercase">
              {label}
            </label>
            <input
              value={values[key] ?? ""}
              onChange={(e) => handleChange(key, e.target.value)}
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saveState === "saving" || saveState === "idle" || saveState === "saved"}
          className="w-fit rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40"
        >
          {saveState === "saving" ? "Salvando..." : "Salvar Alterações"}
        </button>

        {saveState === "saved" && (
          <p className="text-[12px]" style={{ color: "#25D366" }}>
            ✓ Salvo
          </p>
        )}
        {saveState === "error" && (
          <p className="text-[12px] text-danger">Não foi possível salvar: {errorMsg}</p>
        )}
      </div>

      {values.whatsapp && (
        <a
          href={`https://wa.me/55${values.whatsapp.replace(/\D/g, "")}`}
          target="_blank"
          rel="noreferrer"
          className="w-fit rounded-btn border border-border-neutral px-3 py-1.5 text-[12.5px]"
          style={{ color: "#25D366" }}
        >
          Abrir WhatsApp
        </a>
      )}
    </div>
  );
}

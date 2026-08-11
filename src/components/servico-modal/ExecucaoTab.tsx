"use client";

import { useState } from "react";
import type { ServicoDetail } from "@/lib/domain/types";
import { updateInformacoesAdicionais, updateLocalInstalacao } from "@/lib/actions/servicos";

function CampoTexto({
  label,
  placeholder,
  valorInicial,
  onSave,
}: {
  label: string;
  placeholder: string;
  valorInicial: string;
  onSave: (texto: string) => Promise<void>;
}) {
  const [valor, setValor] = useState(valorInicial);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function salvar() {
    setSaving(true);
    setError(null);
    try {
      await onSave(valor);
      setDirty(false);
    } catch (err) {
      console.error(`Falha ao salvar ${label}`, err);
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-card border border-border-neutral bg-card-secondary p-3">
      <p className="mb-2 text-[10.5px] tracking-wide text-text-muted uppercase">{label}</p>
      <textarea
        value={valor}
        onChange={(e) => {
          setValor(e.target.value);
          setDirty(true);
        }}
        rows={3}
        placeholder={placeholder}
        className="mb-2 w-full rounded-btn border border-border-neutral bg-card px-3 py-1.5 text-sm"
      />
      <button
        type="button"
        onClick={salvar}
        disabled={!dirty || saving}
        className="w-fit rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-3 py-1.5 text-[12.5px] font-semibold text-bg disabled:opacity-40"
      >
        {saving ? "Salvando..." : "Salvar"}
      </button>
      {error && <p className="mt-1.5 text-[12px] text-danger">Não foi possível salvar: {error}</p>}
    </div>
  );
}

export default function ExecucaoTab({
  detail,
  onChanged,
}: {
  detail: ServicoDetail;
  onChanged: () => void;
}) {
  const { servico } = detail;

  return (
    <div className="flex flex-col gap-4">
      <CampoTexto
        label="Local de instalação/entrega"
        placeholder="Endereço, ponto de referência, condições de acesso..."
        valorInicial={servico.local_instalacao ?? ""}
        onSave={async (texto) => {
          await updateLocalInstalacao(servico.id, texto);
          onChanged();
        }}
      />
      <CampoTexto
        label="Informações adicionais · medidas, materiais, observações"
        placeholder="Anote medidas, materiais, ferramentas, observações do local..."
        valorInicial={servico.informacoes_adicionais ?? ""}
        onSave={async (texto) => {
          await updateInformacoesAdicionais(servico.id, texto);
          onChanged();
        }}
      />
    </div>
  );
}

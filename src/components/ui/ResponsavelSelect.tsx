"use client";

import { useState } from "react";

export const RESPONSAVEIS = ["", "Administrador", "Champs"];

/** Select de responsável com opção "Outro" que vira campo de texto livre — pra nomes que não
 * estão na lista fixa (substitutos, freelancers etc.), sem precisar cadastrar ninguém. */
export default function ResponsavelSelect({
  defaultValue,
  onSave,
  className,
}: {
  defaultValue: string;
  onSave: (value: string) => void;
  className?: string;
}) {
  const [manual, setManual] = useState(defaultValue !== "" && !RESPONSAVEIS.includes(defaultValue));
  const [texto, setTexto] = useState(defaultValue);

  if (manual) {
    return (
      <div className="flex gap-1.5">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={() => texto !== defaultValue && onSave(texto)}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          placeholder="Nome do responsável"
          autoFocus
          className={className}
        />
        <button
          type="button"
          onClick={() => setManual(false)}
          title="Escolher da lista"
          className="shrink-0 rounded-btn border border-border-neutral px-2 text-[11px] text-text-secondary hover:text-text"
        >
          ↩
        </button>
      </div>
    );
  }

  return (
    <select
      defaultValue={RESPONSAVEIS.includes(defaultValue) ? defaultValue : ""}
      onChange={(e) => {
        if (e.target.value === "__manual__") {
          setTexto("");
          setManual(true);
          return;
        }
        onSave(e.target.value);
      }}
      className={className}
    >
      {RESPONSAVEIS.map((r) => (
        <option key={r} value={r}>
          {r || "Sem responsável"}
        </option>
      ))}
      <option value="__manual__">✏️ Outro (digitar nome)</option>
    </select>
  );
}

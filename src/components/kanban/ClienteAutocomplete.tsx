"use client";

import { useMemo, useState } from "react";
import type { Cliente } from "@/lib/domain/types";

export default function ClienteAutocomplete({
  clientes,
  value,
  onChange,
}: {
  clientes: Cliente[];
  value: string;
  onChange: (nome: string) => void;
}) {
  const [foco, setFoco] = useState(false);

  const sugestoes = useMemo(() => {
    if (!value) return clientes.slice(0, 8);
    const termo = value.toLowerCase();
    return clientes.filter((c) => c.nome.toLowerCase().includes(termo)).slice(0, 8);
  }, [clientes, value]);

  const existe = clientes.some((c) => c.nome.toLowerCase() === value.toLowerCase());

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFoco(true)}
        onBlur={() => setTimeout(() => setFoco(false), 150)}
        placeholder="Digite para buscar ou criar um cliente"
        className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
      />
      {foco && sugestoes.length > 0 && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-btn border border-border-gold-strong bg-card shadow-lg">
          {sugestoes.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={() => onChange(c.nome)}
              className="block w-full px-3 py-2 text-left text-[13px] hover:bg-card-secondary"
            >
              {c.nome}
              {c.empresa && <span className="text-text-muted"> — {c.empresa}</span>}
            </button>
          ))}
        </div>
      )}
      {value && !existe && (
        <p className="mt-1 text-[11px] text-text-muted">
          Cliente novo — será cadastrado automaticamente como &quot;{value}&quot;
        </p>
      )}
    </div>
  );
}

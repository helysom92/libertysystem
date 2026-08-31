"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Material } from "@/lib/domain/types";
import { fmtBRL } from "@/lib/domain/types";
import { updateMaterial } from "@/lib/actions/materiais";
import NovoMaterialModal from "./NovoMaterialModal";

const UNIDADE_LABELS: Record<Material["unidade"], string> = {
  m2: "m²",
  metro_linear: "metro linear",
  unidade: "unidade",
};

export default function MateriaisList({ materiais }: { materiais: Material[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Material | null>(null);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      {error && (
        <p className="mb-3 rounded-btn border border-danger-border bg-card px-3 py-2 text-[12.5px] text-danger">
          {error}
        </p>
      )}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="font-display text-lg font-bold">Materiais (Custos de Referência)</h2>
          <p className="text-[12.5px] text-text-secondary">
            Custos de materiais/terceiros, para consulta ao calcular itens sob projeto
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-4 py-2 text-sm font-semibold text-bg"
        >
          + Novo Material
        </button>
      </div>

      <div className="overflow-x-auto rounded-card border border-border-neutral">
        <table className="w-full text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-border-neutral text-[10.5px] tracking-wide text-text-muted uppercase">
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Categoria</th>
              <th className="px-3 py-2">Unidade</th>
              <th className="px-3 py-2">Preço Unitário</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {materiais.map((m) => (
              <tr key={m.id} className="border-b border-border-neutral bg-card">
                <td className="px-3 py-2 font-semibold">{m.nome}</td>
                <td className="px-3 py-2 text-text-secondary">{m.categoria || "—"}</td>
                <td className="px-3 py-2 text-text-secondary">{UNIDADE_LABELS[m.unidade]}</td>
                <td className="px-3 py-2 font-semibold text-gradient-gold">
                  {fmtBRL(m.preco_unitario)}
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() =>
                      startTransition(async () => {
                        const resultado = await updateMaterial(m.id, { ativo: !m.ativo });
                        if (!resultado.ok) {
                          setError(resultado.message);
                        } else {
                          router.refresh();
                        }
                      })
                    }
                    className="rounded-pill px-2 py-0.5 text-[10.5px] font-semibold"
                    style={{
                      color: m.ativo ? "#25D366" : "rgba(244,242,236,0.5)",
                      border: "1px solid currentColor",
                    }}
                  >
                    {m.ativo ? "Ativo" : "Inativo"}
                  </button>
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setEditing(m)}
                    className="text-[11.5px] text-gold hover:underline"
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
            {materiais.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-text-muted">
                  Nenhum material cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <NovoMaterialModal
          onClose={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
      {editing && (
        <NovoMaterialModal
          material={editing}
          onClose={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

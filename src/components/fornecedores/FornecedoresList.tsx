"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Fornecedor } from "@/lib/domain/types";
import { updateFornecedor } from "@/lib/actions/fornecedores";
import NovoFornecedorModal from "./NovoFornecedorModal";

export default function FornecedoresList({ fornecedores }: { fornecedores: Fornecedor[] }) {
  const router = useRouter();
  const [novoOpen, setNovoOpen] = useState(false);
  const [, startTransition] = useTransition();

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display text-xl font-bold">Fornecedores</h1>
          <p className="text-[13px] text-text-secondary">Cadastre seus fornecedores</p>
        </div>
        <button
          type="button"
          onClick={() => setNovoOpen(true)}
          className="rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-4 py-2 text-sm font-semibold text-bg"
        >
          + Novo Fornecedor
        </button>
      </div>

      <div className="overflow-x-auto rounded-card border border-border-neutral">
        <table className="w-full text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-border-neutral text-[10.5px] tracking-wide text-text-muted uppercase">
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Categoria</th>
              <th className="px-3 py-2">Telefone</th>
              <th className="px-3 py-2">E-mail</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {fornecedores.map((f) => (
              <tr key={f.id} className="border-b border-border-neutral bg-card">
                <td className="px-3 py-2 font-semibold">{f.nome}</td>
                <td className="px-3 py-2 text-text-secondary">{f.categoria || "—"}</td>
                <td className="px-3 py-2 text-text-secondary">{f.telefone || "—"}</td>
                <td className="px-3 py-2 text-text-secondary">{f.email || "—"}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() =>
                      startTransition(async () => {
                        await updateFornecedor(f.id, { ativo: !f.ativo });
                        router.refresh();
                      })
                    }
                    className="rounded-pill px-2 py-0.5 text-[10.5px] font-semibold"
                    style={{
                      color: f.ativo ? "#25D366" : "rgba(244,242,236,0.5)",
                      border: "1px solid currentColor",
                    }}
                  >
                    {f.ativo ? "Ativo" : "Inativo"}
                  </button>
                </td>
              </tr>
            ))}
            {fornecedores.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-text-muted">
                  Nenhum fornecedor cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {novoOpen && (
        <NovoFornecedorModal
          onClose={() => {
            setNovoOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ItemOrcamento } from "@/lib/domain/types";
import { fmtBRL } from "@/lib/domain/types";
import { updateItemOrcamento } from "@/lib/actions/itensOrcamento";
import NovoItemOrcamentoModal from "./NovoItemOrcamentoModal";

export default function ItensOrcamentoList({ itens }: { itens: ItemOrcamento[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-bold">Itens de Orçamento</h2>
          <p className="text-[12.5px] text-text-secondary">Tabela de preços usada na calculadora</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-4 py-2 text-sm font-semibold text-bg"
        >
          + Novo Item
        </button>
      </div>

      <div className="overflow-x-auto rounded-card border border-border-neutral">
        <table className="w-full text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-border-neutral text-[10.5px] tracking-wide text-text-muted uppercase">
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Categoria</th>
              <th className="px-3 py-2">Cobrança</th>
              <th className="px-3 py-2">Preço</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((i) => (
              <tr key={i.id} className="border-b border-border-neutral bg-card">
                <td className="px-3 py-2 font-semibold">{i.nome}</td>
                <td className="px-3 py-2 text-text-secondary">{i.categoria || "—"}</td>
                <td className="px-3 py-2 text-text-secondary">
                  {i.tipo_cobranca === "m2" ? "Por m²" : "Fixo"}
                </td>
                <td className="px-3 py-2 font-semibold text-gradient-gold">
                  {i.preco != null ? fmtBRL(i.preco) : "Sob projeto"}
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() =>
                      startTransition(async () => {
                        await updateItemOrcamento(i.id, { ativo: !i.ativo });
                        router.refresh();
                      })
                    }
                    className="rounded-pill px-2 py-0.5 text-[10.5px] font-semibold"
                    style={{
                      color: i.ativo ? "#25D366" : "rgba(244,242,236,0.5)",
                      border: "1px solid currentColor",
                    }}
                  >
                    {i.ativo ? "Ativo" : "Inativo"}
                  </button>
                </td>
              </tr>
            ))}
            {itens.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-text-muted">
                  Nenhum item cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <NovoItemOrcamentoModal
          onClose={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

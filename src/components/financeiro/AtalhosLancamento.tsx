"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Fornecedor, LancamentoAtalho } from "@/lib/domain/types";
import { todayISO } from "@/lib/domain/dates";
import { lancarAtalho } from "@/lib/actions/lancamentoAtalhos";
import GerenciarAtalhosModal from "./GerenciarAtalhosModal";

export default function AtalhosLancamento({
  atalhos,
  fornecedores,
}: {
  atalhos: LancamentoAtalho[];
  fornecedores: Fornecedor[];
}) {
  const router = useRouter();
  const [abrindoId, setAbrindoId] = useState<string | null>(null);
  const [valor, setValor] = useState("");
  const [data, setData] = useState(todayISO());
  const [lancando, setLancando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gerenciando, setGerenciando] = useState(false);

  function abrir(atalhoId: string) {
    setAbrindoId(atalhoId);
    setValor("");
    setData(todayISO());
    setError(null);
  }

  async function confirmar() {
    if (!abrindoId) return;
    setLancando(true);
    setError(null);
    try {
      await lancarAtalho(abrindoId, { valor: Number(valor) || 0, data });
      setAbrindoId(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível lançar essa despesa.");
    } finally {
      setLancando(false);
    }
  }

  return (
    <div className="mb-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {atalhos.length === 0 ? (
          <button
            type="button"
            onClick={() => setGerenciando(true)}
            className="w-fit text-[11.5px] text-gold hover:underline"
          >
            + Criar atalho de despesa recorrente
          </button>
        ) : (
          <>
            {atalhos.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => abrir(a.id)}
                className={`rounded-btn border px-2.5 py-1.5 text-[11.5px] ${
                  abrindoId === a.id
                    ? "border-gold bg-gold/10 text-gold"
                    : "border-border-neutral text-text-secondary hover:text-text"
                }`}
              >
                {a.descricao}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setGerenciando(true)}
              className="rounded-btn px-2 py-1.5 text-[11.5px] text-text-muted hover:text-text-secondary"
              title="Gerenciar atalhos"
            >
              ⚙️
            </button>
          </>
        )}
      </div>

      {abrindoId && (
        <div className="mt-2 flex flex-wrap items-end gap-2 rounded-btn border border-border-gold-strong bg-card-secondary p-2.5">
          <div>
            <label className="mb-1 block text-[11px] text-text-secondary">Valor</label>
            <input
              type="number"
              step="0.01"
              autoFocus
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="w-28 rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-text-secondary">Data</label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={confirmar}
            disabled={lancando}
            className="rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-3 py-1.5 text-[12.5px] font-semibold text-bg disabled:opacity-60"
          >
            {lancando ? "Lançando..." : "Lançar"}
          </button>
          <button
            type="button"
            onClick={() => setAbrindoId(null)}
            className="rounded-btn px-3 py-1.5 text-[12.5px] text-text-secondary"
          >
            Cancelar
          </button>
          {error && <p className="text-[12px] text-danger">{error}</p>}
        </div>
      )}

      {gerenciando && (
        <GerenciarAtalhosModal
          atalhos={atalhos}
          fornecedores={fornecedores}
          onClose={() => {
            setGerenciando(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

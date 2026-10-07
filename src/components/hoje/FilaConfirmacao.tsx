"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { aprovarMovimento, baixarPrevisto, ignorarMovimento } from "@/lib/actions/fila";
import { UNIDADES } from "@/lib/domain/regras";
import type { ItemFila } from "@/lib/domain/filaConfirmacao";
import { fmtBRL, type UnidadeNegocio } from "@/lib/domain/types";

function dataBR(iso: string): string {
  return iso.split("-").reverse().join("/");
}

function ItemDaFila({ item, onResolvido }: { item: ItemFila; onResolvido: () => void }) {
  const { movimento, regra, baixas } = item;
  const [categoria, setCategoria] = useState(item.categoriaSugerida);
  const [unidade, setUnidade] = useState<UnidadeNegocio | "">(item.unidadeSugerida ?? "");
  const [lembrar, setLembrar] = useState(false);
  const [lembrarComo, setLembrarComo] = useState(movimento.contraparte ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function executar(acao: () => Promise<{ ok: true } | { ok: false; message: string }>) {
    setError(null);
    startTransition(async () => {
      const resultado = await acao();
      if (!resultado.ok) setError(resultado.message);
      else onResolvido();
    });
  }

  const cor = movimento.tipo === "Despesa" ? "text-danger" : "text-success";

  return (
    <div className="rounded-btn bg-card-secondary px-3 py-2.5 text-[12.5px]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{movimento.descricao}</p>
          <p className="text-[11px] text-text-muted">
            {dataBR(movimento.data)} · {movimento.tipo}
            {regra ? ` · regra: ${regra.padrao}` : ""}
          </p>
        </div>
        <span className={`font-semibold ${cor}`}>{fmtBRL(movimento.valor)}</span>
      </div>

      {baixas.length > 0 && (
        <div className="mt-2 rounded-btn border border-border-gold p-2">
          <p className="mb-1 text-[11px] text-text-secondary">
            Parece um lançamento que você já fez como previsto — dar baixa evita duplicar:
          </p>
          {baixas.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-0.5">
              <span>
                {b.descricao} · vence {dataBR(b.data)} · {fmtBRL(b.valor)}
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => executar(() => baixarPrevisto(movimento.id, b.id))}
                className="rounded-btn bg-gold px-2.5 py-1 text-[11.5px] font-semibold text-bg disabled:opacity-60"
              >
                Dar baixa
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          placeholder="Categoria"
          className="w-28 rounded-btn border border-border-neutral bg-card px-2 py-1 text-[11.5px]"
        />
        <select
          value={unidade}
          onChange={(e) => setUnidade(e.target.value as UnidadeNegocio | "")}
          aria-label="Unidade de negócio"
          className="rounded-btn border border-border-neutral bg-card px-2 py-1 text-[11.5px]"
        >
          <option value="">Com. Visual</option>
          {UNIDADES.filter((u) => u.valor !== "comunicacao_visual").map((u) => (
            <option key={u.valor} value={u.valor}>
              {u.rotulo}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            executar(() =>
              aprovarMovimento({
                movimentoId: movimento.id,
                categoria,
                unidade: unidade || null,
                lembrarComo: lembrar ? lembrarComo : null,
              })
            )
          }
          className="rounded-btn border border-border-gold-strong px-2.5 py-1 text-[11.5px] font-semibold text-gold disabled:opacity-60"
        >
          {baixas.length > 0 ? "Lançar como novo" : "Aprovar e lançar"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => executar(() => ignorarMovimento(movimento.id))}
          className="rounded-btn px-2.5 py-1 text-[11.5px] text-text-muted hover:text-text disabled:opacity-60"
        >
          Ignorar
        </button>
      </div>

      {!regra && (
        <label className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px] text-text-secondary">
          <input type="checkbox" checked={lembrar} onChange={(e) => setLembrar(e.target.checked)} />
          Lembrar: sempre que o nome contiver
          <input
            value={lembrarComo}
            onChange={(e) => setLembrarComo(e.target.value)}
            disabled={!lembrar}
            className="w-44 rounded-btn border border-border-neutral bg-card px-2 py-1 text-[11.5px] disabled:opacity-50"
          />
        </label>
      )}

      {error && <p className="mt-1 text-[11.5px] text-danger">{error}</p>}
    </div>
  );
}

export default function FilaConfirmacao({ itens }: { itens: ItemFila[] }) {
  const router = useRouter();
  const [resolvidos, setResolvidos] = useState<Set<string>>(new Set());
  const pendentes = itens.filter((i) => !resolvidos.has(i.movimento.id));

  if (pendentes.length === 0) return null;

  return (
    <div className="rounded-card border border-border-gold bg-card p-4">
      <h3 className="mb-1 font-display text-sm font-bold">
        <span className="mr-1.5 text-gold">●</span>
        Pra confirmar ({pendentes.length})
      </h3>
      <p className="mb-3 text-[12px] text-text-secondary">
        Movimentos que chegaram do Mercado Pago. Nada vira lançamento até você aprovar.
      </p>
      <div className="flex flex-col gap-2">
        {pendentes.map((item) => (
          <ItemDaFila
            key={item.movimento.id}
            item={item}
            onResolvido={() => {
              setResolvidos((atual) => new Set(atual).add(item.movimento.id));
              router.refresh();
            }}
          />
        ))}
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { alternarRegra, criarRegra, excluirRegra } from "@/lib/actions/regras";
import { UNIDADES, rotuloUnidade, type RegraLancamento } from "@/lib/domain/regras";
import { fmtBRL, type UnidadeNegocio } from "@/lib/domain/types";

const CAMPO = "w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm";

export default function RegrasAprendidasPanel({
  regras,
  onChanged,
}: {
  regras: RegraLancamento[];
  onChanged: () => void;
}) {
  const [padrao, setPadrao] = useState("");
  const [tipo, setTipo] = useState<"" | "Receita" | "Despesa">("");
  const [unidade, setUnidade] = useState<UnidadeNegocio | "">("");
  const [categoria, setCategoria] = useState("");
  const [mensal, setMensal] = useState(false);
  const [valorTipico, setValorTipico] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function adicionar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const resultado = await criarRegra({
        padrao,
        tipo: tipo || null,
        categoria: categoria || null,
        unidade_negocio: unidade || null,
        recorrencia: mensal ? "mensal" : "nenhuma",
        valor_tipico: valorTipico ? Number(valorTipico) : null,
      });
      if (!resultado.ok) {
        setError(resultado.message);
        return;
      }
      setPadrao("");
      setTipo("");
      setUnidade("");
      setCategoria("");
      setMensal(false);
      setValorTipico("");
      onChanged();
    });
  }

  function alternar(r: RegraLancamento) {
    setError(null);
    startTransition(async () => {
      const resultado = await alternarRegra(r.id, !r.ativo);
      if (!resultado.ok) setError(resultado.message);
      else onChanged();
    });
  }

  function excluir(r: RegraLancamento) {
    if (!confirm(`Apagar a regra "${r.padrao}"?`)) return;
    setError(null);
    startTransition(async () => {
      const resultado = await excluirRegra(r.id);
      if (!resultado.ok) setError(resultado.message);
      else onChanged();
    });
  }

  return (
    <div className="rounded-card border border-border-neutral bg-card p-4">
      <h3 className="font-display text-sm font-bold">Regras aprendidas</h3>
      <p className="mb-3 text-[12px] text-text-secondary">
        Ensine uma vez: quando o nome aparecer no banco, o sistema já sugere categoria e unidade (você ainda
        aprova cada lançamento).
      </p>

      <form onSubmit={adicionar} className="mb-3 grid gap-2 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs text-text-secondary">Quando o nome contiver</label>
          <input
            value={padrao}
            onChange={(e) => setPadrao(e.target.value)}
            placeholder="Ex: Agência Lupa"
            className={CAMPO}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-text-secondary">Tipo</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as "" | "Receita" | "Despesa")} className={CAMPO}>
            <option value="">Qualquer</option>
            <option value="Receita">Receita</option>
            <option value="Despesa">Despesa</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-text-secondary">Unidade de negócio</label>
          <select value={unidade} onChange={(e) => setUnidade(e.target.value as UnidadeNegocio | "")} className={CAMPO}>
            <option value="">Padrão (Comunicação Visual)</option>
            {UNIDADES.map((u) => (
              <option key={u.valor} value={u.valor}>
                {u.rotulo}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-text-secondary">Categoria</label>
          <input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Ex: Mídia" className={CAMPO} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-text-secondary">Valor típico (opcional)</label>
          <input
            type="number"
            step="0.01"
            value={valorTipico}
            onChange={(e) => setValorTipico(e.target.value)}
            className={CAMPO}
          />
        </div>
        <label className="flex items-center gap-2 text-[12.5px] sm:col-span-2">
          <input type="checkbox" checked={mensal} onChange={(e) => setMensal(e.target.checked)} />
          Acontece todo mês (usado nas previsões)
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pending || !padrao.trim()}
            className="rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-4 py-2 text-sm font-semibold text-bg disabled:opacity-60"
          >
            {pending ? "Salvando..." : "Adicionar regra"}
          </button>
        </div>
      </form>

      {error && <p className="mb-2 text-[12.5px] text-danger">{error}</p>}

      <div className="flex flex-col gap-1.5">
        {regras.map((r) => (
          <div
            key={r.id}
            className={`flex flex-wrap items-center justify-between gap-2 rounded-btn bg-card-secondary px-3 py-2 text-[12.5px] ${
              r.ativo ? "" : "opacity-50"
            }`}
          >
            <div>
              <p className="font-medium">{r.padrao}</p>
              <p className="text-[11px] text-text-muted">
                {r.tipo ?? "Receita ou despesa"} · {r.unidade_negocio ? rotuloUnidade(r.unidade_negocio) : "Comunicação Visual"}
                {r.categoria ? ` · ${r.categoria}` : ""}
                {r.recorrencia === "mensal" ? " · todo mês" : ""}
                {r.valor_tipico != null ? ` · ~${fmtBRL(r.valor_tipico)}` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => alternar(r)}
                disabled={pending}
                className="rounded-btn border border-border-neutral px-2.5 py-1 text-[11.5px] disabled:opacity-60"
              >
                {r.ativo ? "Desativar" : "Ativar"}
              </button>
              <button
                type="button"
                onClick={() => excluir(r)}
                disabled={pending}
                className="rounded-btn border border-danger-border px-2.5 py-1 text-[11.5px] text-danger disabled:opacity-60"
              >
                Apagar
              </button>
            </div>
          </div>
        ))}
        {regras.length === 0 && <p className="text-sm text-text-muted">Nenhuma regra ainda.</p>}
      </div>
    </div>
  );
}

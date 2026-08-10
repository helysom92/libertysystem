"use client";

import { useState } from "react";
import { fmtBRL } from "@/lib/domain/types";
import { classificarMeta, fmtPct, META_LABELS, type Meta, type MetaTipo } from "@/lib/domain/dashboardMetrics";
import { updateMeta } from "@/lib/actions/metas";
import ProgressBar from "./charts/ProgressBar";
import Pill from "./Pill";

const IS_PCT: Record<MetaTipo, boolean> = {
  vendas_mensais: false,
  despesas_mensais: false,
  novos_clientes: false,
  margem_liquida: true,
};

function fmtValor(tipo: MetaTipo, v: number): string {
  if (tipo === "novos_clientes") return String(Math.round(v));
  if (IS_PCT[tipo]) return fmtPct(v);
  return fmtBRL(v);
}

function GoalCard({ meta, atual, onSaved }: { meta: Meta; atual: number; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [valor, setValor] = useState(String(meta.valor_alvo));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cls = classificarMeta(meta.tipo, meta.valor_alvo, atual);

  async function salvar() {
    setSaving(true);
    setError(null);
    try {
      await updateMeta(meta.tipo, Number(valor) || 0);
      setEditing(false);
      onSaved();
    } catch (err) {
      console.error("Falha ao salvar meta", err);
      setError(err instanceof Error ? err.message : "Não foi possível salvar essa meta.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-card border border-border-neutral bg-card p-5">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="font-display text-[15px] font-bold text-text">{META_LABELS[meta.tipo]}</p>
        <Pill label={cls.status} color={cls.statusColor} />
      </div>

      {editing ? (
        <div className="mb-3 flex items-center gap-2">
          <input
            type="number"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="w-32 rounded-btn border border-border-neutral bg-card-secondary px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={salvar}
            disabled={saving}
            className="rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-3 py-1.5 text-[12px] font-semibold text-bg disabled:opacity-40"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-[12px] text-text-secondary hover:text-text"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <div className="mb-3 flex items-center gap-2">
          <p className="text-[13px] text-text-secondary">
            Meta: {fmtValor(meta.tipo, meta.valor_alvo)} · Atual: {fmtValor(meta.tipo, atual)}
          </p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[11.5px] text-gold hover:underline"
          >
            Editar
          </button>
        </div>
      )}

      <ProgressBar pct={cls.pct} />
      <p className="mt-1.5 text-right text-[12px] font-semibold text-text">{fmtPct(cls.pct, 0)}</p>
      {error && <p className="mt-1.5 text-[12px] text-danger">{error}</p>}
    </div>
  );
}

export default function MetasView({
  metas,
  atuais,
  onChanged,
}: {
  metas: Meta[];
  atuais: Record<MetaTipo, number>;
  onChanged: () => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {metas.map((m) => (
        <GoalCard key={m.tipo} meta={m} atual={atuais[m.tipo] ?? 0} onSaved={onChanged} />
      ))}
    </div>
  );
}

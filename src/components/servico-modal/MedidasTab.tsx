"use client";

import { useState, useTransition } from "react";
import type { ServicoDetail } from "@/lib/domain/types";
import { addMedida, type NovaMedidaInput } from "@/lib/actions/servicoDetail";

const EMPTY: NovaMedidaInput = {
  largura: 0,
  altura: 0,
  profundidade: 0,
  unidade: "cm",
  quantidade: 1,
  local_medicao: "",
  responsavel: "",
  observacoes: "",
};

export default function MedidasTab({
  detail,
  onChanged,
}: {
  detail: ServicoDetail;
  onChanged: () => void;
}) {
  const [form, setForm] = useState<NovaMedidaInput>(EMPTY);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await addMedida(detail.servico.id, form);
      setForm(EMPTY);
      onChanged();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <form
        onSubmit={submit}
        className="grid grid-cols-3 gap-2 rounded-card border border-border-neutral bg-card-secondary p-3"
      >
        <input
          type="number"
          placeholder="Largura"
          value={form.largura || ""}
          onChange={(e) => setForm((f) => ({ ...f, largura: Number(e.target.value) }))}
          className="rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
        />
        <input
          type="number"
          placeholder="Altura"
          value={form.altura || ""}
          onChange={(e) => setForm((f) => ({ ...f, altura: Number(e.target.value) }))}
          className="rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
        />
        <select
          value={form.unidade}
          onChange={(e) => setForm((f) => ({ ...f, unidade: e.target.value as NovaMedidaInput["unidade"] }))}
          className="rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
        >
          <option value="m">m</option>
          <option value="cm">cm</option>
          <option value="mm">mm</option>
        </select>
        <input
          type="number"
          placeholder="Profundidade (opcional)"
          value={form.profundidade || ""}
          onChange={(e) => setForm((f) => ({ ...f, profundidade: Number(e.target.value) }))}
          className="rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
        />
        <input
          type="number"
          placeholder="Quantidade"
          value={form.quantidade}
          onChange={(e) => setForm((f) => ({ ...f, quantidade: Number(e.target.value) }))}
          className="rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
        />
        <input
          placeholder="Local da medição"
          value={form.local_medicao}
          onChange={(e) => setForm((f) => ({ ...f, local_medicao: e.target.value }))}
          className="rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
        />
        <input
          placeholder="Responsável"
          value={form.responsavel}
          onChange={(e) => setForm((f) => ({ ...f, responsavel: e.target.value }))}
          className="col-span-3 rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
        />
        <input
          placeholder="Observações"
          value={form.observacoes}
          onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
          className="col-span-3 rounded-btn border border-border-neutral bg-card px-2 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="col-span-3 rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark py-2 text-sm font-semibold text-bg disabled:opacity-60"
        >
          Adicionar Medição
        </button>
      </form>

      <div className="flex flex-col gap-2">
        {detail.medidas.map((m) => (
          <div
            key={m.id}
            className="rounded-card border border-border-neutral bg-card-secondary p-3 text-[12.5px]"
          >
            <p className="font-semibold">
              {m.largura} × {m.altura}
              {m.profundidade ? ` × ${m.profundidade}` : ""} {m.unidade} · qtd {m.quantidade}
            </p>
            <p className="text-text-secondary">
              {m.local_medicao} · {m.responsavel} · {m.data}
            </p>
            {m.observacoes && <p className="text-text-muted">{m.observacoes}</p>}
            <span
              className="mt-1 inline-block rounded-pill px-2 py-0.5 text-[10.5px]"
              style={{
                color: m.status_revisao === "Confirmada" ? "#25D366" : "#E0A64E",
                border: "1px solid currentColor",
              }}
            >
              {m.status_revisao}
            </span>
          </div>
        ))}
        {detail.medidas.length === 0 && (
          <p className="text-sm text-text-muted">Nenhuma medição registrada.</p>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchServicosDoCliente, type ServicoDoCliente } from "@/lib/supabase/fetchServicosDoCliente";
import { fmtBRL, displayNumero } from "@/lib/domain/types";
import { fmtDatePtBR } from "@/lib/domain/dates";

/** Junta todos os serviços de um cliente numa lista só, com total selecionável — pensado
 * pra compilar os dados de uma nota fiscal que cubra mais de uma OS do mesmo cliente. */
export default function ClienteServicosModal({
  clienteId,
  clienteNome,
  clienteCpfCnpj,
  clienteEndereco,
  onClose,
}: {
  clienteId: string;
  clienteNome: string;
  clienteCpfCnpj: string | null;
  clienteEndereco: string | null;
  onClose: () => void;
}) {
  const [servicos, setServicos] = useState<ServicoDoCliente[] | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchServicosDoCliente(clienteId).then((lista) => {
      if (cancelled) return;
      setServicos(lista);
      setSelecionados(new Set(lista.map((s) => s.id)));
    });
    return () => {
      cancelled = true;
    };
  }, [clienteId]);

  function toggle(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const listaSelecionada = useMemo(
    () => (servicos ?? []).filter((s) => selecionados.has(s.id)),
    [servicos, selecionados]
  );
  const total = listaSelecionada.reduce((sum, s) => sum + s.valor, 0);

  async function copiarResumo() {
    const linhas = [
      `Cliente: ${clienteNome}`,
      clienteCpfCnpj ? `CPF/CNPJ: ${clienteCpfCnpj}` : null,
      clienteEndereco ? `Endereço: ${clienteEndereco}` : null,
      "",
      ...listaSelecionada.map(
        (s) => `${s.numero ?? "(sem número)"} — ${s.descricao || "(sem descrição)"} — ${fmtDatePtBR(s.criado_em.slice(0, 10))} — ${fmtBRL(s.valor)}`
      ),
      "",
      `TOTAL: ${fmtBRL(total)}`,
    ].filter((l): l is string => l !== null);

    try {
      await navigator.clipboard.writeText(linhas.join("\n"));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // best-effort
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4 py-8">
      <div
        className="flex h-full w-full max-w-xl flex-col rounded-card border border-border-gold bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border-neutral px-6 py-4">
          <div>
            <p className="text-[11px] tracking-wide text-text-muted uppercase">Todos os serviços</p>
            <h2 className="font-display text-lg font-bold">{clienteNome}</h2>
            {clienteCpfCnpj && <p className="text-[12px] text-text-secondary">{clienteCpfCnpj}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-btn px-3 py-1 text-text-secondary hover:text-text">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {servicos === null ? (
            <p className="text-center text-text-muted">Carregando...</p>
          ) : servicos.length === 0 ? (
            <p className="text-center text-text-muted">Nenhum serviço encontrado pra esse cliente.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {servicos.map((s) => (
                <label
                  key={s.id}
                  className="flex cursor-pointer items-center gap-3 rounded-btn bg-card-secondary px-3 py-2 text-[12.5px]"
                >
                  <input
                    type="checkbox"
                    checked={selecionados.has(s.id)}
                    onChange={() => toggle(s.id)}
                  />
                  <div className="flex-1">
                    <p className="font-medium">
                      {displayNumero(s)}
                      {s.descricao && <span className="text-text-secondary"> · {s.descricao}</span>}
                    </p>
                    <p className="text-[11px] text-text-muted">
                      {fmtDatePtBR(s.criado_em.slice(0, 10))} · {s.financeiro_status}
                    </p>
                  </div>
                  <span className="font-semibold">{fmtBRL(s.valor)}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border-neutral p-6">
          <div className="mb-3 flex items-center justify-between rounded-card bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-4 py-3">
            <span className="text-[13px] font-semibold text-bg">
              Total selecionado ({listaSelecionada.length})
            </span>
            <span className="font-display text-lg font-bold text-bg">{fmtBRL(total)}</span>
          </div>
          <button
            type="button"
            onClick={copiarResumo}
            disabled={listaSelecionada.length === 0}
            className="w-full rounded-btn border border-border-gold-strong px-4 py-2 text-sm font-semibold text-gold disabled:opacity-40"
          >
            {copiado ? "Copiado!" : "📋 Copiar resumo pra nota fiscal"}
          </button>
        </div>
      </div>
    </div>
  );
}

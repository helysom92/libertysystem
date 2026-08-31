"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ContaPessoal, TransferenciaPessoal } from "@/lib/domain/types";
import { arquivarConta } from "@/lib/actions/financasPessoais";
import { fmtBRL } from "@/lib/domain/types";
import { fmtDatePtBR } from "@/lib/domain/dates";
import NovaContaModal from "./NovaContaModal";
import NovaTransferenciaModal from "./NovaTransferenciaModal";

export default function ContasClient({
  contas,
  saldos,
  transferencias,
}: {
  contas: ContaPessoal[];
  saldos: Record<string, number>;
  transferencias: TransferenciaPessoal[];
}) {
  const router = useRouter();
  const [novaOpen, setNovaOpen] = useState(false);
  const [editando, setEditando] = useState<ContaPessoal | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const contaPorId = new Map(contas.map((c) => [c.id, c.nome]));

  const ativas = contas.filter((c) => c.ativa);
  const arquivadas = contas.filter((c) => !c.ativa);
  const saldoTotal = ativas.reduce((s, c) => s + (saldos[c.id] ?? 0), 0);

  return (
    <div>
      {error && (
        <p className="mb-3 rounded-btn border border-danger-border bg-card px-3 py-2 text-[12.5px] text-danger">{error}</p>
      )}
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Contas</h1>
          <p className="text-[13px] text-text-secondary">
            Saldo disponível nas contas ativas: <span className="font-semibold text-text">{fmtBRL(saldoTotal)}</span>
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setTransferOpen(true)}
            disabled={contas.length < 2}
            className="rounded-btn border border-border-gold-strong px-4 py-2 text-sm font-semibold text-gold disabled:opacity-40"
          >
            Transferir
          </button>
          <button
            type="button"
            onClick={() => setNovaOpen(true)}
            className="rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-4 py-2 text-sm font-semibold text-bg"
          >
            + Nova Conta
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {ativas.map((c) => (
          <ContaCard
            key={c.id}
            conta={c}
            saldo={saldos[c.id] ?? 0}
            onEditar={() => setEditando(c)}
            onArquivar={() =>
              startTransition(async () => {
                const resultado = await arquivarConta(c.id, false);
                if (!resultado.ok) {
                  setError(resultado.message);
                  return;
                }
                router.refresh();
              })
            }
          />
        ))}
        {ativas.length === 0 && (
          <p className="col-span-2 rounded-card border border-border-neutral bg-card p-6 text-center text-text-muted">
            Nenhuma conta cadastrada ainda.
          </p>
        )}
      </div>

      {arquivadas.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-[13px] font-semibold text-text-secondary">Arquivadas</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {arquivadas.map((c) => (
              <ContaCard
                key={c.id}
                conta={c}
                saldo={saldos[c.id] ?? 0}
                arquivada
                onEditar={() => setEditando(c)}
                onArquivar={() =>
                  startTransition(async () => {
                    const resultado = await arquivarConta(c.id, true);
                    if (!resultado.ok) {
                      setError(resultado.message);
                      return;
                    }
                    router.refresh();
                  })
                }
              />
            ))}
          </div>
        </div>
      )}

      <div className="mt-8">
        <h2 className="mb-3 text-[13px] font-semibold text-text-secondary">Transferências recentes</h2>
        <div className="overflow-x-auto rounded-card border border-border-neutral">
          <table className="w-full text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-border-neutral text-[10.5px] tracking-wide text-text-muted uppercase">
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">De</th>
                <th className="px-3 py-2">Para</th>
                <th className="px-3 py-2">Valor</th>
                <th className="px-3 py-2">Tarifa</th>
                <th className="px-3 py-2">Descrição</th>
              </tr>
            </thead>
            <tbody>
              {transferencias.map((t) => (
                <tr key={t.id} className="border-b border-border-neutral bg-card">
                  <td className="px-3 py-2">{fmtDatePtBR(t.data)}</td>
                  <td className="px-3 py-2">{contaPorId.get(t.conta_origem_id) ?? "—"}</td>
                  <td className="px-3 py-2">{contaPorId.get(t.conta_destino_id) ?? "—"}</td>
                  <td className="px-3 py-2 font-semibold">{fmtBRL(t.valor)}</td>
                  <td className="px-3 py-2 text-text-secondary">{t.tarifa > 0 ? fmtBRL(t.tarifa) : "—"}</td>
                  <td className="px-3 py-2 text-text-secondary">{t.descricao || "—"}</td>
                </tr>
              ))}
              {transferencias.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-text-muted">
                    Nenhuma transferência registrada ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {novaOpen && (
        <NovaContaModal
          onClose={() => {
            setNovaOpen(false);
            router.refresh();
          }}
        />
      )}
      {editando && (
        <NovaContaModal
          conta={editando}
          onClose={() => {
            setEditando(null);
            router.refresh();
          }}
        />
      )}
      {transferOpen && (
        <NovaTransferenciaModal
          contas={contas}
          onClose={() => {
            setTransferOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function ContaCard({
  conta,
  saldo,
  arquivada,
  onEditar,
  onArquivar,
}: {
  conta: ContaPessoal;
  saldo: number;
  arquivada?: boolean;
  onEditar: () => void;
  onArquivar: () => void;
}) {
  return (
    <div className="rounded-card border border-border-neutral bg-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-text">{conta.nome}</p>
          <p className="text-[12px] text-text-secondary">
            {conta.instituicao || "—"} {conta.tipo ? `· ${conta.tipo}` : ""}
          </p>
        </div>
        <p className={`text-[15px] font-semibold ${saldo < 0 ? "text-danger" : "text-text"}`}>{fmtBRL(saldo)}</p>
      </div>
      <div className="mt-3 flex gap-2 text-[11.5px]">
        <button type="button" onClick={onEditar} className="text-gold hover:underline">
          Editar
        </button>
        <button type="button" onClick={onArquivar} className="text-text-muted hover:underline">
          {arquivada ? "Reativar" : "Arquivar"}
        </button>
      </div>
    </div>
  );
}

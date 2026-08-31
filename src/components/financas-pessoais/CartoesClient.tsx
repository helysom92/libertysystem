"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { CartaoPessoal, CompraCartaoPessoal, DespesaPessoal } from "@/lib/domain/types";
import { fmtBRL } from "@/lib/domain/types";
import { fmtDatePtBR } from "@/lib/domain/dates";
import {
  totalFaturaAberta,
  limiteUsado,
  limiteDisponivel,
  situacaoFatura,
  type SituacaoFaturaPessoal,
} from "@/lib/domain/financasPessoais";
import { arquivarCartao, cancelarCompraCartao, lancarFaturaComoDespesa } from "@/lib/actions/financasPessoais";
import NovoCartaoModal from "./NovoCartaoModal";
import NovaCompraCartaoModal from "./NovaCompraCartaoModal";

const SITUACAO_LABEL: Record<SituacaoFaturaPessoal, string> = {
  sem_compras: "Sem compras",
  nao_lancada: "Não lançada",
  prevista: "Lançada — em aberto",
  parcial: "Parcialmente paga",
  paga: "Paga",
  cancelada: "Cancelada",
};

const SITUACAO_COLOR: Record<SituacaoFaturaPessoal, string> = {
  sem_compras: "text-text-muted",
  nao_lancada: "text-gold",
  prevista: "text-text-secondary",
  parcial: "text-gold",
  paga: "text-success",
  cancelada: "text-text-muted",
};

interface FaturaLinha {
  cartaoId: string;
  ano: number;
  mes: number;
  total: number;
  despesa: DespesaPessoal | null;
}

export default function CartoesClient({
  cartoes,
  compras,
  despesasFatura,
}: {
  cartoes: CartaoPessoal[];
  compras: CompraCartaoPessoal[];
  despesasFatura: DespesaPessoal[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [novoOpen, setNovoOpen] = useState(false);
  const [editando, setEditando] = useState<CartaoPessoal | null>(null);
  const [comprando, setComprando] = useState<CartaoPessoal | null>(null);

  function acao(fn: () => Promise<{ ok: boolean; message?: string }>) {
    startTransition(async () => {
      const resultado = await fn();
      if (!resultado.ok) {
        setError(resultado.message ?? "Não foi possível concluir essa ação.");
        return;
      }
      router.refresh();
    });
  }

  const faturasPagasPorCartao = new Map<string, Set<string>>();
  for (const d of despesasFatura) {
    if (d.situacao !== "paga" || !d.cartao_id || d.fatura_ano == null || d.fatura_mes == null) continue;
    const key = `${d.fatura_ano}-${String(d.fatura_mes).padStart(2, "0")}`;
    const set = faturasPagasPorCartao.get(d.cartao_id) ?? new Set<string>();
    set.add(key);
    faturasPagasPorCartao.set(d.cartao_id, set);
  }

  const ativos = cartoes.filter((c) => c.ativo);
  const arquivados = cartoes.filter((c) => !c.ativo);

  // Faturas: uma linha por (cartão, ano, mês) que tem pelo menos 1 compra não cancelada.
  const faturas: FaturaLinha[] = [];
  const vistos = new Set<string>();
  for (const c of compras) {
    if (c.cancelada_em) continue;
    const key = `${c.cartao_id}-${c.fatura_ano}-${c.fatura_mes}`;
    if (vistos.has(key)) continue;
    vistos.add(key);
    const despesa =
      despesasFatura.find((d) => d.cartao_id === c.cartao_id && d.fatura_ano === c.fatura_ano && d.fatura_mes === c.fatura_mes) ?? null;
    faturas.push({
      cartaoId: c.cartao_id,
      ano: c.fatura_ano,
      mes: c.fatura_mes,
      total: totalFaturaAberta(compras, c.cartao_id, c.fatura_ano, c.fatura_mes),
      despesa,
    });
  }
  faturas.sort((a, b) => (a.ano === b.ano ? a.mes - b.mes : a.ano - b.ano));

  return (
    <div>
      {error && (
        <p className="mb-3 rounded-btn border border-danger-border bg-card px-3 py-2 text-[12.5px] text-danger">{error}</p>
      )}
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Cartões e Faturas</h1>
          <p className="text-[13px] text-text-secondary">Compra vira compromisso — o pagamento da fatura é que vira despesa.</p>
        </div>
        <button
          type="button"
          onClick={() => setNovoOpen(true)}
          className="shrink-0 rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-4 py-2 text-sm font-semibold text-bg"
        >
          + Novo Cartão
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {ativos.map((c) => {
          const usado = limiteUsado(c.id, compras, faturasPagasPorCartao.get(c.id) ?? new Set());
          const disponivel = limiteDisponivel(c, usado);
          return (
            <div key={c.id} className="rounded-card border border-border-neutral bg-card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-text">{c.nome}</p>
                  <p className="text-[12px] text-text-secondary">
                    {c.banco || "—"} · fecha dia {c.dia_fechamento} · vence dia {c.dia_vencimento}
                  </p>
                </div>
              </div>
              <div className="mt-2 text-[12.5px]">
                <p className="text-text-secondary">
                  Limite usado: <span className="font-semibold text-text">{fmtBRL(usado)}</span>
                </p>
                {disponivel != null && (
                  <p className="text-text-secondary">
                    Disponível: <span className={`font-semibold ${disponivel < 0 ? "text-danger" : "text-success"}`}>{fmtBRL(disponivel)}</span>
                  </p>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11.5px]">
                <button type="button" onClick={() => setComprando(c)} className="text-gold hover:underline">
                  + Nova Compra
                </button>
                <button type="button" onClick={() => setEditando(c)} className="text-text-secondary hover:underline">
                  Editar
                </button>
                <button type="button" onClick={() => acao(() => arquivarCartao(c.id, false))} className="text-text-muted hover:underline">
                  Desativar
                </button>
              </div>
            </div>
          );
        })}
        {ativos.length === 0 && (
          <p className="col-span-2 rounded-card border border-border-neutral bg-card p-6 text-center text-text-muted">
            Nenhum cartão cadastrado ainda.
          </p>
        )}
      </div>

      {arquivados.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 text-[13px] font-semibold text-text-secondary">Desativados</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {arquivados.map((c) => (
              <div key={c.id} className="rounded-card border border-border-neutral bg-card p-4">
                <p className="font-semibold text-text">{c.nome}</p>
                <button
                  type="button"
                  onClick={() => acao(() => arquivarCartao(c.id, true))}
                  className="mt-2 text-[11.5px] text-gold hover:underline"
                >
                  Reativar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8">
        <h2 className="mb-3 text-[13px] font-semibold text-text-secondary">Faturas</h2>
        <div className="overflow-x-auto rounded-card border border-border-neutral">
          <table className="w-full text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-border-neutral text-[10.5px] tracking-wide text-text-muted uppercase">
                <th className="px-3 py-2">Cartão</th>
                <th className="px-3 py-2">Mês</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Situação</th>
                <th className="px-3 py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {faturas.map((f) => {
                const cartao = cartoes.find((c) => c.id === f.cartaoId);
                const situacao = situacaoFatura(f.despesa, f.total);
                return (
                  <tr key={`${f.cartaoId}-${f.ano}-${f.mes}`} className="border-b border-border-neutral bg-card align-top">
                    <td className="px-3 py-2 font-semibold text-text">{cartao?.nome ?? "—"}</td>
                    <td className="px-3 py-2">
                      {String(f.mes).padStart(2, "0")}/{f.ano}
                    </td>
                    <td className="px-3 py-2 font-semibold">{fmtBRL(f.total)}</td>
                    <td className={`px-3 py-2 font-semibold ${SITUACAO_COLOR[situacao]}`}>{SITUACAO_LABEL[situacao]}</td>
                    <td className="px-3 py-2">
                      {situacao === "nao_lancada" ? (
                        <button
                          type="button"
                          onClick={() => acao(() => lancarFaturaComoDespesa(f.cartaoId, f.ano, f.mes))}
                          className="text-gold hover:underline"
                        >
                          Lançar fatura como despesa
                        </button>
                      ) : f.despesa ? (
                        <Link href="/financas-pessoais/receitas-despesas" className="text-text-secondary hover:underline">
                          Ver/pagar em Despesas
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
              {faturas.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-text-muted">
                    Nenhuma compra registrada ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-[13px] font-semibold text-text-secondary">Compras recentes</h2>
        <div className="overflow-x-auto rounded-card border border-border-neutral">
          <table className="w-full text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-border-neutral text-[10.5px] tracking-wide text-text-muted uppercase">
                <th className="px-3 py-2">Descrição</th>
                <th className="px-3 py-2">Cartão</th>
                <th className="px-3 py-2">Parcela</th>
                <th className="px-3 py-2">Valor</th>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Fatura</th>
                <th className="px-3 py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {compras
                .slice()
                .sort((a, b) => b.data_compra.localeCompare(a.data_compra))
                .slice(0, 40)
                .map((c) => {
                  const cartao = cartoes.find((ca) => ca.id === c.cartao_id);
                  return (
                    <tr key={c.id} className={`border-b border-border-neutral bg-card ${c.cancelada_em ? "opacity-50" : ""}`}>
                      <td className="px-3 py-2">
                        <p className={c.cancelada_em ? "text-text-muted line-through" : "font-semibold text-text"}>{c.descricao}</p>
                        {c.categoria && <p className="text-text-muted">{c.categoria}</p>}
                      </td>
                      <td className="px-3 py-2 text-text-secondary">{cartao?.nome ?? "—"}</td>
                      <td className="px-3 py-2 text-text-secondary">
                        {c.numero_parcela}/{c.parcelas_total}
                      </td>
                      <td className="px-3 py-2 font-semibold">{fmtBRL(c.valor_parcela)}</td>
                      <td className="px-3 py-2">{fmtDatePtBR(c.data_compra)}</td>
                      <td className="px-3 py-2">
                        {String(c.fatura_mes).padStart(2, "0")}/{c.fatura_ano}
                      </td>
                      <td className="px-3 py-2">
                        {!c.cancelada_em && (
                          <button
                            type="button"
                            onClick={() => {
                              const motivo = window.prompt("Motivo do cancelamento (opcional):") ?? "";
                              acao(() => cancelarCompraCartao(c.compra_grupo_id, motivo || null));
                            }}
                            className="text-danger hover:underline"
                          >
                            Cancelar compra
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              {compras.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-text-muted">
                    Nenhuma compra registrada ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {novoOpen && (
        <NovoCartaoModal
          onClose={() => {
            setNovoOpen(false);
            router.refresh();
          }}
        />
      )}
      {editando && (
        <NovoCartaoModal
          cartao={editando}
          onClose={() => {
            setEditando(null);
            router.refresh();
          }}
        />
      )}
      {comprando && (
        <NovaCompraCartaoModal
          cartao={comprando}
          onClose={() => {
            setComprando(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

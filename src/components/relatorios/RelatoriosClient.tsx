"use client";

import { useMemo, useState } from "react";
import type { Cliente, Fornecedor, Lancamento, Servico } from "@/lib/domain/types";
import { displayNumero, fmtBRL } from "@/lib/domain/types";
import { computeClienteStats } from "@/lib/domain/clientes";
import { todayISO } from "@/lib/domain/dates";
import FinanceiroBadge from "@/components/ui/FinanceiroBadge";

const TABS = ["Vendas", "Clientes", "Financeiro", "Despesas", "Receitas"] as const;
type Tab = (typeof TABS)[number];

function startOfMonthISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function RelatoriosClient({
  servicos,
  clientes,
  lancamentos,
  fornecedores,
}: {
  servicos: Servico[];
  clientes: Cliente[];
  lancamentos: Lancamento[];
  fornecedores: Fornecedor[];
}) {
  const [tab, setTab] = useState<Tab>("Vendas");
  const [de, setDe] = useState(startOfMonthISO());
  const [ate, setAte] = useState(todayISO());

  const fornecedorNome = (id: string | null) => fornecedores.find((f) => f.id === id)?.nome ?? "—";

  const servicosPeriodo = useMemo(
    () => servicos.filter((s) => s.criado_em.slice(0, 10) >= de && s.criado_em.slice(0, 10) <= ate),
    [servicos, de, ate]
  );

  const lancamentosPeriodo = useMemo(
    () => lancamentos.filter((l) => l.data >= de && l.data <= ate),
    [lancamentos, de, ate]
  );

  const receitasPeriodo = lancamentosPeriodo.filter((l) => l.tipo === "Receita");
  const despesasPeriodo = lancamentosPeriodo.filter((l) => l.tipo === "Despesa");

  function imprimir() {
    window.print();
  }

  return (
    <div>
      <div className="no-print mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display text-xl font-bold">Relatórios</h1>
          <p className="text-[13px] text-text-secondary">Extraia relatórios simples do seu negócio</p>
        </div>
        <button
          type="button"
          onClick={imprimir}
          className="rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-4 py-2 text-sm font-semibold text-bg"
        >
          Imprimir / Exportar PDF
        </button>
      </div>

      <div className="no-print mb-4 flex items-center justify-between gap-4">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-btn px-3 py-1.5 text-[12.5px] ${
                tab === t ? "bg-card font-semibold text-gold" : "text-text-secondary hover:bg-card"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        {tab !== "Clientes" && (
          <div className="flex items-center gap-2 text-[12.5px]">
            <label className="text-text-secondary">De</label>
            <input
              type="date"
              value={de}
              onChange={(e) => setDe(e.target.value)}
              className="rounded-btn border border-border-neutral bg-card-secondary px-2 py-1 text-sm"
            />
            <label className="text-text-secondary">até</label>
            <input
              type="date"
              value={ate}
              onChange={(e) => setAte(e.target.value)}
              className="rounded-btn border border-border-neutral bg-card-secondary px-2 py-1 text-sm"
            />
          </div>
        )}
      </div>

      <h2 className="mb-3 hidden font-display text-lg font-bold print:block">
        Relatório de {tab} ({de} a {ate})
      </h2>

      {tab === "Vendas" && (
        <div className="overflow-x-auto rounded-card border border-border-neutral">
          <table className="w-full text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-border-neutral text-[10.5px] tracking-wide text-text-muted uppercase">
                <th className="px-3 py-2">Número</th>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Descrição</th>
                <th className="px-3 py-2">Valor</th>
                <th className="px-3 py-2">Status Financeiro</th>
                <th className="px-3 py-2">Etapa</th>
              </tr>
            </thead>
            <tbody>
              {servicosPeriodo.map((s) => (
                <tr key={s.id} className="border-b border-border-neutral bg-card">
                  <td className="px-3 py-2 text-text-secondary">{displayNumero(s)}</td>
                  <td className="px-3 py-2 font-semibold">{s.cliente}</td>
                  <td className="px-3 py-2 text-text-secondary">{s.descricao}</td>
                  <td className="px-3 py-2 font-semibold text-gradient-gold">{fmtBRL(s.valor)}</td>
                  <td className="px-3 py-2">
                    <FinanceiroBadge status={s.financeiro_status} />
                  </td>
                  <td className="px-3 py-2 text-text-secondary">{s.estagio}</td>
                </tr>
              ))}
              {servicosPeriodo.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-text-muted">
                    Nenhum serviço no período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "Clientes" && (
        <div className="overflow-x-auto rounded-card border border-border-neutral">
          <table className="w-full text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-border-neutral text-[10.5px] tracking-wide text-text-muted uppercase">
                <th className="px-3 py-2">Nome</th>
                <th className="px-3 py-2">Serviços</th>
                <th className="px-3 py-2">Total Comprado</th>
                <th className="px-3 py-2">Última Compra</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => {
                const stats = computeClienteStats(c.id, servicos);
                return (
                  <tr key={c.id} className="border-b border-border-neutral bg-card">
                    <td className="px-3 py-2 font-semibold">{c.nome}</td>
                    <td className="px-3 py-2">{stats.servicosVinculados}</td>
                    <td className="px-3 py-2 font-semibold text-gradient-gold">
                      {fmtBRL(stats.totalComprado)}
                    </td>
                    <td className="px-3 py-2 text-text-secondary">
                      {stats.ultimaCompra
                        ? new Date(stats.ultimaCompra).toLocaleDateString("pt-BR")
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === "Financeiro" && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-card border border-border-neutral bg-card p-4">
            <p className="mb-1 text-[10.5px] tracking-wide text-text-muted uppercase">Receitas</p>
            <p className="font-display text-xl font-bold">
              {fmtBRL(receitasPeriodo.reduce((a, l) => a + l.valor, 0))}
            </p>
          </div>
          <div className="rounded-card border border-border-neutral bg-card p-4">
            <p className="mb-1 text-[10.5px] tracking-wide text-text-muted uppercase">Despesas</p>
            <p className="font-display text-xl font-bold">
              {fmtBRL(despesasPeriodo.reduce((a, l) => a + l.valor, 0))}
            </p>
          </div>
          <div className="rounded-card border border-border-neutral bg-card p-4">
            <p className="mb-1 text-[10.5px] tracking-wide text-text-muted uppercase">Saldo</p>
            <p className="font-display text-xl font-bold text-gradient-gold">
              {fmtBRL(
                receitasPeriodo.reduce((a, l) => a + l.valor, 0) -
                  despesasPeriodo.reduce((a, l) => a + l.valor, 0)
              )}
            </p>
          </div>
        </div>
      )}

      {(tab === "Despesas" || tab === "Receitas") && (
        <div className="overflow-x-auto rounded-card border border-border-neutral">
          <table className="w-full text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-border-neutral text-[10.5px] tracking-wide text-text-muted uppercase">
                <th className="px-3 py-2">Descrição</th>
                <th className="px-3 py-2">Categoria</th>
                <th className="px-3 py-2">Fornecedor</th>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Valor</th>
              </tr>
            </thead>
            <tbody>
              {(tab === "Despesas" ? despesasPeriodo : receitasPeriodo).map((l) => (
                <tr key={l.id} className="border-b border-border-neutral bg-card">
                  <td className="px-3 py-2 font-semibold">{l.descricao}</td>
                  <td className="px-3 py-2 text-text-secondary">{l.categoria || "—"}</td>
                  <td className="px-3 py-2 text-text-secondary">{fornecedorNome(l.fornecedor_id)}</td>
                  <td className="px-3 py-2 text-text-secondary">
                    {new Date(l.data + "T00:00:00").toLocaleDateString("pt-BR")}
                  </td>
                  <td className={`px-3 py-2 font-semibold ${tab === "Despesas" ? "text-danger" : "text-success"}`}>
                    {fmtBRL(l.valor)}
                  </td>
                </tr>
              ))}
              {(tab === "Despesas" ? despesasPeriodo : receitasPeriodo).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-text-muted">
                    Nenhum lançamento no período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

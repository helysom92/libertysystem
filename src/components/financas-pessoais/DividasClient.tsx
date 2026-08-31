"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ContaPessoal, DividaPessoal, PagamentoDividaPessoal } from "@/lib/domain/types";
import { fmtBRL } from "@/lib/domain/types";
import { hojeISOOperacao } from "@/lib/domain/dates";
import { saldoDivida, parcelasRestantesAtual, situacaoDividaVencimento } from "@/lib/domain/financasPessoais";
import {
  registrarPagamentoDivida,
  listarPagamentosDaDivida,
  estornarPagamentoDivida,
  deleteDivida,
} from "@/lib/actions/financasPessoais";
import NovaDividaModal from "./NovaDividaModal";
import RegistrarValorModal from "./RegistrarValorModal";
import HistoricoPessoalModal from "./HistoricoPessoalModal";

type Situacao = ReturnType<typeof situacaoDividaVencimento>;

const SITUACAO_LABEL: Record<Situacao, string> = {
  quitada: "Quitada",
  sem_vencimento: "Sem vencimento fixo",
  vencida: "Vencida esse mês",
  a_vencer: "Em dia",
  em_dia: "Paga esse mês",
};

const SITUACAO_COLOR: Record<Situacao, string> = {
  quitada: "text-success",
  sem_vencimento: "text-text-secondary",
  vencida: "text-danger",
  a_vencer: "text-text-secondary",
  em_dia: "text-success",
};

export default function DividasClient({
  contas,
  dividas,
  pagamentos,
}: {
  contas: ContaPessoal[];
  dividas: DividaPessoal[];
  pagamentos: PagamentoDividaPessoal[];
}) {
  const router = useRouter();
  const hoje = hojeISOOperacao();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [novaOpen, setNovaOpen] = useState(false);
  const [editando, setEditando] = useState<DividaPessoal | null>(null);
  const [registrando, setRegistrando] = useState<DividaPessoal | null>(null);
  const [historico, setHistorico] = useState<DividaPessoal | null>(null);

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

  const ativas = dividas.filter((d) => d.situacao === "ativa");
  const quitadas = dividas.filter((d) => d.situacao === "quitada");
  const totalDevedor = ativas.reduce((s, d) => s + saldoDivida(d, pagamentos), 0);

  return (
    <div>
      {error && (
        <p className="mb-3 rounded-btn border border-danger-border bg-card px-3 py-2 text-[12.5px] text-danger">{error}</p>
      )}
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Dívidas</h1>
          <p className="text-[13px] text-text-secondary">
            Total devedor em dívidas ativas: <span className="font-semibold text-danger">{fmtBRL(totalDevedor)}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setNovaOpen(true)}
          className="shrink-0 rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-4 py-2 text-sm font-semibold text-bg"
        >
          + Nova Dívida
        </button>
      </div>

      <div className="overflow-x-auto rounded-card border border-border-neutral">
        <table className="w-full text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-border-neutral text-[10.5px] tracking-wide text-text-muted uppercase">
              <th className="px-3 py-2">Credor</th>
              <th className="px-3 py-2">Saldo devedor</th>
              <th className="px-3 py-2">Parcela</th>
              <th className="px-3 py-2">Parcelas restantes</th>
              <th className="px-3 py-2">Situação</th>
              <th className="px-3 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {ativas.map((d) => {
              const saldo = saldoDivida(d, pagamentos);
              const restantes = parcelasRestantesAtual(d, pagamentos);
              const situacao = situacaoDividaVencimento(d, pagamentos, hoje);
              return (
                <tr key={d.id} className="border-b border-border-neutral bg-card align-top">
                  <td className="px-3 py-2">
                    <p className="font-semibold text-text">{d.credor}</p>
                    {d.descricao && <p className="text-text-muted">{d.descricao}</p>}
                  </td>
                  <td className="px-3 py-2 font-semibold">{fmtBRL(saldo)}</td>
                  <td className="px-3 py-2">{d.valor_parcela != null ? fmtBRL(d.valor_parcela) : "—"}</td>
                  <td className="px-3 py-2">{restantes ?? "—"}</td>
                  <td className={`px-3 py-2 font-semibold ${SITUACAO_COLOR[situacao]}`}>{SITUACAO_LABEL[situacao]}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => setRegistrando(d)} className="text-gold hover:underline">
                        Registrar pagamento
                      </button>
                      <button type="button" onClick={() => setHistorico(d)} className="text-text-secondary hover:underline">
                        Histórico
                      </button>
                      <button type="button" onClick={() => setEditando(d)} className="text-text-secondary hover:underline">
                        Editar
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {ativas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-text-muted">
                  Nenhuma dívida ativa cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {quitadas.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-[13px] font-semibold text-text-secondary">Quitadas</h2>
          <div className="overflow-x-auto rounded-card border border-border-neutral">
            <table className="w-full text-left text-[12.5px]">
              <tbody>
                {quitadas.map((d) => (
                  <tr key={d.id} className="border-b border-border-neutral bg-card">
                    <td className="px-3 py-2 font-semibold text-text">{d.credor}</td>
                    <td className="px-3 py-2 text-success">Quitada</td>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => setHistorico(d)} className="text-text-secondary hover:underline">
                        Histórico
                      </button>
                      {" · "}
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm("Excluir esta dívida definitivamente? (bloqueado se já tiver pagamento)"))
                            acao(() => deleteDivida(d.id));
                        }}
                        className="text-danger hover:underline"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {novaOpen && (
        <NovaDividaModal
          onClose={() => {
            setNovaOpen(false);
            router.refresh();
          }}
        />
      )}
      {editando && (
        <NovaDividaModal
          divida={editando}
          onClose={() => {
            setEditando(null);
            router.refresh();
          }}
        />
      )}
      {registrando && (
        <RegistrarValorModal
          titulo={`Registrar pagamento — ${registrando.credor}`}
          saldoAberto={saldoDivida(registrando, pagamentos)}
          contas={contas}
          contaLabel="Conta usada"
          onConfirm={(valor, data, contaId) => registrarPagamentoDivida(registrando.id, { valor, data, contaId })}
          onClose={() => {
            setRegistrando(null);
            router.refresh();
          }}
        />
      )}
      {historico && (
        <HistoricoPessoalModal
          titulo={`Histórico de pagamentos — ${historico.credor}`}
          carregar={() => listarPagamentosDaDivida(historico.id)}
          onEstornar={async (id, motivo) => {
            const resultado = await estornarPagamentoDivida(id, motivo);
            if (resultado.ok) router.refresh();
            return resultado;
          }}
          onFechar={() => {
            setHistorico(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

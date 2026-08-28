"use client";

import { useMemo, useState } from "react";
import { fmtBRL } from "@/lib/domain/types";
import type { Servico, ServicoParcela } from "@/lib/domain/types";
import { fmtDatePtBR, hojeISOOperacao } from "@/lib/domain/dates";
import { normalizarBusca } from "@/lib/domain/texto";
import type { Role } from "@/lib/domain/flows";
import RecebimentoModal from "./RecebimentoModal";

type ServicoResumo = Pick<Servico, "id" | "numero" | "cliente" | "valor" | "valor_pago" | "financeiro_status" | "prazo" | "concluido" | "criado_em">;

type Situacao = "recebido" | "parcial" | "a_vencer" | "vencido" | "sem_vencimento" | "sem_parcelas" | "cancelado";

interface LinhaRecebimento {
  id: string;
  servicoId: string;
  numero: string | null;
  cliente: string;
  descricao: string;
  valorOriginal: number;
  valorRecebido: number;
  saldo: number;
  vencimento: string | null;
  ultimoRecebimento: string | null;
  situacao: Situacao;
}

const ABAS: { id: Situacao; label: string }[] = [
  { id: "recebido", label: "Recebidos" },
  { id: "parcial", label: "Parcialmente recebidos" },
  { id: "a_vencer", label: "A vencer" },
  { id: "vencido", label: "Vencidos" },
  { id: "sem_vencimento", label: "Sem vencimento" },
  { id: "sem_parcelas", label: "Sem parcelas" },
  { id: "cancelado", label: "Cancelados" },
];

const SITUACAO_LABEL: Record<Situacao, string> = {
  recebido: "Recebido",
  parcial: "Parcial",
  a_vencer: "A vencer",
  vencido: "Vencido",
  sem_vencimento: "Sem vencimento",
  sem_parcelas: "Sem parcelas",
  cancelado: "Cancelado",
};

const SITUACAO_COR: Record<Situacao, string> = {
  recebido: "#25D366",
  parcial: "#E0A64E",
  a_vencer: "#8a6ba0",
  vencido: "#E07A7A",
  sem_vencimento: "rgba(244,242,236,0.6)",
  sem_parcelas: "rgba(244,242,236,0.6)",
  cancelado: "#8a8378",
};

function classificar(p: ServicoParcela, hoje: string): Situacao {
  if (p.cancelada_em) return "cancelado";
  const pago = p.valor_pago ?? 0;
  const saldo = Math.max(0, p.valor_previsto - pago);
  if (saldo <= 0) return "recebido";
  if (pago > 0) return "parcial";
  if (!p.data_prevista) return "sem_vencimento";
  return p.data_prevista < hoje ? "vencido" : "a_vencer";
}

export default function RecebimentosClient({
  servicos,
  parcelas,
  role,
}: {
  servicos: ServicoResumo[];
  parcelas: ServicoParcela[];
  role: Role;
}) {
  const [aba, setAba] = useState<Situacao>("vencido");
  const [busca, setBusca] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const hoje = hojeISOOperacao();

  const servicoPorId = useMemo(() => new Map(servicos.map((s) => [s.id, s])), [servicos]);

  const linhas: LinhaRecebimento[] = useMemo(() => {
    const resultado: LinhaRecebimento[] = [];
    const servicosComParcela = new Set<string>();

    for (const p of parcelas) {
      const sv = servicoPorId.get(p.servico_id);
      if (!sv) continue; // parcela de um orçamento ainda não aprovado — fora do escopo de Recebimentos
      servicosComParcela.add(sv.id);
      resultado.push({
        id: p.id,
        servicoId: sv.id,
        numero: sv.numero,
        cliente: sv.cliente,
        descricao: p.descricao,
        valorOriginal: p.valor_previsto,
        valorRecebido: p.valor_pago ?? 0,
        saldo: Math.max(0, p.valor_previsto - (p.valor_pago ?? 0)),
        vencimento: p.data_prevista,
        ultimoRecebimento: p.pago_em,
        situacao: sv.financeiro_status === "Cancelado" && !p.cancelada_em ? "cancelado" : classificar(p, hoje),
      });
    }

    for (const sv of servicos) {
      if (servicosComParcela.has(sv.id)) continue;
      resultado.push({
        id: `servico-${sv.id}`,
        servicoId: sv.id,
        numero: sv.numero,
        cliente: sv.cliente,
        descricao: "Sem parcelas lançadas",
        valorOriginal: sv.valor,
        valorRecebido: sv.valor_pago,
        saldo: Math.max(0, sv.valor - sv.valor_pago),
        vencimento: sv.prazo,
        ultimoRecebimento: null,
        situacao: sv.financeiro_status === "Cancelado" ? "cancelado" : "sem_parcelas",
      });
    }

    return resultado;
  }, [parcelas, servicos, servicoPorId, hoje]);

  const filtradas = useMemo(() => {
    return linhas.filter((l) => {
      if (l.situacao !== aba) return false;
      if (busca) {
        const termo = normalizarBusca(busca);
        const bate = normalizarBusca(l.cliente).includes(termo) || (l.numero && normalizarBusca(l.numero).includes(termo));
        if (!bate) return false;
      }
      return true;
    });
  }, [linhas, aba, busca]);

  const somaFiltradas = filtradas.reduce((s, l) => s + (aba === "recebido" ? l.valorRecebido : l.saldo), 0);
  const contagemPorAba = useMemo(() => {
    const map = new Map<Situacao, number>();
    for (const l of linhas) map.set(l.situacao, (map.get(l.situacao) ?? 0) + 1);
    return map;
  }, [linhas]);

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold">Recebimentos</h1>
          <p className="text-[13px] text-text-secondary">Cada parcela/saldo de OS — clique numa linha pra ver/lançar o pagamento</p>
        </div>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por cliente ou nº..."
          className="w-64 rounded-btn border border-border-neutral bg-card-secondary px-3 py-1.5 text-sm"
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1">
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAba(a.id)}
            className={`rounded-btn px-3 py-1.5 text-[12.5px] ${
              aba === a.id ? "bg-card font-semibold text-gold" : "text-text-secondary hover:bg-card"
            }`}
          >
            {a.label} {contagemPorAba.get(a.id) ? `(${contagemPorAba.get(a.id)})` : ""}
          </button>
        ))}
      </div>

      <div className="mb-3 flex items-center justify-between rounded-btn bg-card-secondary px-3 py-2 text-[12.5px]">
        <span className="text-text-secondary">
          {filtradas.length} registro{filtradas.length === 1 ? "" : "s"}
        </span>
        <span className="font-semibold text-gold">
          {aba === "recebido" ? "Total recebido" : "Total em aberto"}: {fmtBRL(somaFiltradas)}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        {filtradas.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => setOpenId(l.servicoId)}
            className="flex w-full flex-col gap-1.5 rounded-btn border border-border-neutral bg-card p-3 text-left text-[12.5px] hover:bg-card-secondary sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-semibold">
                {l.numero} — {l.cliente}
              </p>
              <p className="text-text-muted">
                {l.descricao} · venc. {l.vencimento ? fmtDatePtBR(l.vencimento) : "—"}
                {l.ultimoRecebimento && ` · último recebimento ${fmtDatePtBR(l.ultimoRecebimento.slice(0, 10))}`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span>Original: {fmtBRL(l.valorOriginal)}</span>
              <span>Recebido: {fmtBRL(l.valorRecebido)}</span>
              <span className="font-semibold">Saldo: {fmtBRL(l.saldo)}</span>
              <span className="rounded-pill px-2 py-0.5 text-[10.5px]" style={{ color: SITUACAO_COR[l.situacao], border: "1px solid currentColor" }}>
                {SITUACAO_LABEL[l.situacao]}
              </span>
            </div>
          </button>
        ))}
        {filtradas.length === 0 && <p className="py-6 text-center text-sm text-text-muted">Nenhum registro nessa aba.</p>}
      </div>

      {openId && <RecebimentoModal servicoId={openId} role={role} onClose={() => setOpenId(null)} />}
    </div>
  );
}

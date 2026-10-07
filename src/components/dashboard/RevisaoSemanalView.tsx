"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { filaDeConfirmacao } from "@/lib/actions/fila";
import { concluirRevisao, listarRevisoes, reabrirRevisao, type RevisaoSalva } from "@/lib/actions/revisaoSemanal";
import { fmtDatePtBR } from "@/lib/domain/dates";
import {
  montarRevisao,
  resumoDaRevisao,
  type DadosRevisao,
  type ItemRevisao,
} from "@/lib/domain/revisaoSemanal";
import { fmtBRL } from "@/lib/domain/types";

const dataBR = (d: string) => fmtDatePtBR(d.slice(0, 10));

function Lista({ titulo, itens, vazio, cor }: { titulo: string; itens: ItemRevisao[]; vazio: string; cor?: string }) {
  const total = itens.reduce((s, i) => s + i.valor, 0);
  return (
    <div>
      <p className="mb-1 flex items-center justify-between text-[11px] tracking-wide text-text-muted uppercase">
        <span>
          {titulo} ({itens.length})
        </span>
        {itens.length > 0 && <span className={cor}>{fmtBRL(total)}</span>}
      </p>
      {itens.length === 0 ? (
        <p className="text-[12.5px] text-text-muted">{vazio}</p>
      ) : (
        <div className="flex flex-col gap-1">
          {itens.slice(0, 40).map((i) => (
            <div
              key={`${i.id}-${i.data}`}
              className="flex items-center justify-between gap-2 rounded-btn bg-card-secondary px-3 py-1.5 text-[12.5px]"
            >
              <span>
                {i.descricao} <span className="text-text-muted">· {dataBR(i.data)}</span>
              </span>
              <span className="font-semibold">{fmtBRL(i.valor)}</span>
            </div>
          ))}
          {itens.length > 40 && <p className="text-[11.5px] text-text-muted">…e mais {itens.length - 40}.</p>}
        </div>
      )}
    </div>
  );
}

function Secao({
  titulo,
  destaque,
  conferido,
  onToggle,
  children,
}: {
  titulo: string;
  destaque: string;
  conferido: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-border-neutral bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-sm font-bold">{titulo}</h3>
        <div className="flex items-center gap-3 text-[12.5px]">
          <span className="text-text-secondary">{destaque}</span>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={conferido} onChange={onToggle} />
            Conferido
          </label>
        </div>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

export default function RevisaoSemanalView(props: DadosRevisao) {
  const router = useRouter();
  const revisao = useMemo(
    () => montarRevisao(props),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      props.hojeISO,
      props.servicos,
      props.lancamentos,
      props.servicoParcelas,
      props.despesasFixas,
      props.despesasFixasOcorrencias,
      props.despesasVariaveis,
      props.despesasVariaveisOcorrencias,
    ]
  );

  const [salvas, setSalvas] = useState<RevisaoSalva[]>([]);
  const [bancoPendentes, setBancoPendentes] = useState<number | null>(null);
  const [conferido, setConferido] = useState<Record<string, boolean>>({});
  const [observacao, setObservacao] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function recarregarSalvas() {
    listarRevisoes()
      .then(setSalvas)
      .catch(() => setSalvas([]));
  }

  useEffect(() => {
    let cancelado = false;
    listarRevisoes()
      .then((r) => {
        if (!cancelado) setSalvas(r);
      })
      .catch(() => {
        if (!cancelado) setSalvas([]);
      });
    filaDeConfirmacao()
      .then((f) => {
        if (!cancelado) setBancoPendentes(f.itens.length);
      })
      .catch(() => {
        if (!cancelado) setBancoPendentes(null);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const desta = salvas.find((s) => s.semana_inicio === revisao.semanaInicio);
  const alternar = (chave: string) => setConferido((c) => ({ ...c, [chave]: !c[chave] }));
  const secoes = ["banco", "entregas", "pagar", "receber", "fluxo", "comercial"];
  const faltam = secoes.filter((s) => !conferido[s]).length;

  function concluir() {
    if (faltam > 0 && !confirm(`${faltam} seção(ões) ainda sem "Conferido". Concluir a revisão mesmo assim?`)) return;
    setError(null);
    startTransition(async () => {
      const resultado = await concluirRevisao({
        semanaInicio: revisao.semanaInicio,
        observacao: observacao || null,
        resumo: resumoDaRevisao(revisao, bancoPendentes),
      });
      if (!resultado.ok) {
        setError(resultado.message);
        return;
      }
      recarregarSalvas();
      router.refresh();
    });
  }

  function reabrir() {
    setError(null);
    startTransition(async () => {
      const resultado = await reabrirRevisao(revisao.semanaInicio);
      if (!resultado.ok) {
        setError(resultado.message);
        return;
      }
      recarregarSalvas();
      router.refresh();
    });
  }

  const f = revisao.fluxoSemanaAnterior;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold">Revisão semanal</h2>
        <p className="text-[13px] text-text-secondary">
          Semana de {dataBR(revisao.semanaInicio)} a {dataBR(revisao.semanaFim)} · próximos 7 dias:{" "}
          {dataBR(revisao.janela.inicio)} a {dataBR(revisao.janela.fim)}
        </p>
      </div>

      <div
        className={`rounded-card border p-3 text-[13px] ${
          desta ? "border-success/40 bg-card" : "border-border-gold bg-card"
        }`}
      >
        {desta ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              ✓ Revisada em {new Date(desta.revisado_em).toLocaleString("pt-BR")}
              {desta.observacao ? ` — “${desta.observacao}”` : ""}
            </span>
            <button
              type="button"
              onClick={reabrir}
              disabled={pending}
              className="rounded-btn border border-border-neutral px-3 py-1 text-[12px] disabled:opacity-60"
            >
              Reabrir
            </button>
          </div>
        ) : (
          <span>Esta semana ainda não foi revisada. Passe por cada bloco, marque “Conferido” e conclua no fim.</span>
        )}
      </div>

      <Secao
        titulo="Fila do banco (Mercado Pago)"
        destaque={bancoPendentes == null ? "carregando…" : `${bancoPendentes} pra confirmar`}
        conferido={!!conferido.banco}
        onToggle={() => alternar("banco")}
      >
        <p className="text-[12.5px] text-text-secondary">
          Movimentos que chegaram do banco e ainda esperam você aprovar, dar baixa ou ignorar.{" "}
          <a href="/hoje" className="text-gold underline">
            Abrir a fila na tela Hoje
          </a>
        </p>
      </Secao>

      <Secao
        titulo="Trabalhos a entregar"
        destaque={`${revisao.entregas.atrasadas.length} atrasado(s) · ${revisao.entregas.proximas.length} nos próximos 7 dias`}
        conferido={!!conferido.entregas}
        onToggle={() => alternar("entregas")}
      >
        <Lista titulo="Atrasados" itens={revisao.entregas.atrasadas} vazio="Nenhuma OS atrasada." cor="text-danger" />
        <Lista titulo="Prazo nos próximos 7 dias" itens={revisao.entregas.proximas} vazio="Nenhuma entrega prevista." />
      </Secao>

      <Secao
        titulo="Contas a pagar"
        destaque={`${revisao.pagar.vencidas.length} vencida(s) · ${revisao.pagar.proximas.length} nos próximos 7 dias`}
        conferido={!!conferido.pagar}
        onToggle={() => alternar("pagar")}
      >
        <Lista titulo="Vencidas" itens={revisao.pagar.vencidas} vazio="Nada vencido." cor="text-danger" />
        <Lista titulo="Vencem nos próximos 7 dias" itens={revisao.pagar.proximas} vazio="Nada a pagar nesta janela." />
      </Secao>

      <Secao
        titulo="Recebimentos"
        destaque={`${revisao.receber.atrasadas.length} atrasado(s) · ${revisao.receber.proximas.length} nos próximos 7 dias`}
        conferido={!!conferido.receber}
        onToggle={() => alternar("receber")}
      >
        <Lista titulo="Atrasados" itens={revisao.receber.atrasadas} vazio="Nenhum recebimento atrasado." cor="text-danger" />
        <Lista titulo="Previstos nos próximos 7 dias" itens={revisao.receber.proximas} vazio="Nada previsto nesta janela." cor="text-success" />
      </Secao>

      <Secao
        titulo="Fluxo e previsão"
        destaque={`Semana passada: ${fmtBRL(f.resultado)}`}
        conferido={!!conferido.fluxo}
        onToggle={() => alternar("fluxo")}
      >
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-btn bg-card-secondary p-3">
            <p className="text-[11px] text-text-muted uppercase">
              Recebido ({dataBR(f.inicio)} a {dataBR(f.fim)})
            </p>
            <p className="font-display text-lg font-bold text-success">{fmtBRL(f.recebido)}</p>
            <p className="text-[11.5px] text-text-muted">{f.qtdRecebido} lançamento(s)</p>
          </div>
          <div className="rounded-btn bg-card-secondary p-3">
            <p className="text-[11px] text-text-muted uppercase">Pago na semana passada</p>
            <p className="font-display text-lg font-bold text-danger">{fmtBRL(f.pago)}</p>
            <p className="text-[11.5px] text-text-muted">{f.qtdPago} lançamento(s)</p>
          </div>
          <div className="rounded-btn bg-card-secondary p-3">
            <p className="text-[11px] text-text-muted uppercase">Resultado</p>
            <p className={`font-display text-lg font-bold ${f.resultado < 0 ? "text-danger" : "text-success"}`}>
              {fmtBRL(f.resultado)}
            </p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-btn bg-card-secondary p-3">
            <p className="text-[11px] text-text-muted uppercase">Deve entrar (7 dias)</p>
            <p className="font-display text-lg font-bold text-success">{fmtBRL(revisao.previsao.entra)}</p>
          </div>
          <div className="rounded-btn bg-card-secondary p-3">
            <p className="text-[11px] text-text-muted uppercase">Deve sair (7 dias)</p>
            <p className="font-display text-lg font-bold text-danger">{fmtBRL(revisao.previsao.sai)}</p>
          </div>
          <div className="rounded-btn bg-card-secondary p-3">
            <p className="text-[11px] text-text-muted uppercase">Saldo previsto da semana</p>
            <p className={`font-display text-lg font-bold ${revisao.previsao.saldo < 0 ? "text-danger" : "text-success"}`}>
              {fmtBRL(revisao.previsao.saldo)}
            </p>
          </div>
        </div>
      </Secao>

      <Secao
        titulo="Comercial"
        destaque={`${revisao.comercial.aguardandoResposta.length} proposta(s) sem resposta · ${revisao.comercial.propostasVencidas.length} vencida(s)`}
        conferido={!!conferido.comercial}
        onToggle={() => alternar("comercial")}
      >
        <Lista titulo="Propostas aguardando resposta" itens={revisao.comercial.aguardandoResposta} vazio="Nenhuma proposta aguardando." />
        <Lista titulo="Propostas com validade vencida" itens={revisao.comercial.propostasVencidas} vazio="Nenhuma proposta vencida." cor="text-danger" />
        {revisao.comercial.alertas.length > 0 && (
          <div>
            <p className="mb-1 text-[11px] tracking-wide text-text-muted uppercase">
              Alertas ({revisao.comercial.alertas.length})
            </p>
            <div className="flex flex-col gap-1">
              {revisao.comercial.alertas.slice(0, 15).map((a, i) => (
                <p key={i} className="rounded-btn bg-card-secondary px-3 py-1.5 text-[12.5px]">
                  {a}
                </p>
              ))}
            </div>
          </div>
        )}
      </Secao>

      {!desta && (
        <div className="rounded-card border border-border-gold bg-card p-4">
          <label className="mb-1 block text-xs text-text-secondary">Observação da semana (opcional)</label>
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={2}
            className="mb-3 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            placeholder="Ex: cobrar Rodrigo na quarta; renegociar boleto da gráfica"
          />
          {error && <p className="mb-2 text-[12.5px] text-danger">{error}</p>}
          <button
            type="button"
            onClick={concluir}
            disabled={pending}
            className="rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-4 py-2 text-sm font-semibold text-bg disabled:opacity-60"
          >
            {pending ? "Salvando..." : "Concluir revisão da semana"}
          </button>
        </div>
      )}
      {desta && error && <p className="text-[12.5px] text-danger">{error}</p>}

      {salvas.length > 0 && (
        <div>
          <p className="mb-2 text-[10.5px] tracking-wide text-text-muted uppercase">Semanas já revisadas</p>
          <div className="flex flex-col gap-1">
            {salvas.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-btn bg-card-secondary px-3 py-2 text-[12.5px]"
              >
                <span>Semana de {dataBR(s.semana_inicio)}</span>
                <span className="text-text-muted">
                  revisada em {new Date(s.revisado_em).toLocaleDateString("pt-BR")}
                  {s.observacao ? ` · ${s.observacao}` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

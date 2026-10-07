"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resolverPendencias, type ItemParaResolver } from "@/lib/actions/resolverPendencias";
import { fmtDatePtBR } from "@/lib/domain/dates";
import type { ItemRevisao } from "@/lib/domain/revisaoSemanal";
import { fmtBRL } from "@/lib/domain/types";

const dataBR = (d: string) => fmtDatePtBR(d.slice(0, 10));
const chaveDe = (i: ItemRevisao) => `${i.acao?.kind}:${i.id}:${i.data}`;
const POR_CHAMADA = 15;

/**
 * Lista com seleção: marca vários itens e resolve de uma vez (pago/recebido ou cancelar),
 * sempre pelas ações oficiais — ver `resolverPendencias`. `modo` só troca os textos.
 */
export default function ListaEmLote({
  titulo,
  itens,
  vazio,
  modo,
  cor,
}: {
  titulo: string;
  itens: ItemRevisao[];
  vazio: string;
  modo: "pagar" | "receber";
  cor?: string;
}) {
  const router = useRouter();
  const [selecao, setSelecao] = useState<Set<string>>(new Set());
  const [dataModo, setDataModo] = useState<"vencimento" | "unica">("vencimento");
  const [dataUnica, setDataUnica] = useState("");
  const [motivo, setMotivo] = useState("");
  const [pending, startTransition] = useTransition();
  const [progresso, setProgresso] = useState<string | null>(null);
  const [falhas, setFalhas] = useState<{ descricao: string; message: string }[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const selecionaveis = itens.filter((i) => i.acao);
  const escolhidos = selecionaveis.filter((i) => selecao.has(chaveDe(i)));
  const totalEscolhido = escolhidos.reduce((s, i) => s + i.valor, 0);
  const total = itens.reduce((s, i) => s + i.valor, 0);
  const verboPago = modo === "pagar" ? "paga" : "recebida";

  function alternar(chave: string) {
    setSelecao((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      return novo;
    });
  }

  function aplicar(resultado: "pago" | "cancelado") {
    setErro(null);
    setFalhas([]);
    if (resultado === "pago" && dataModo === "unica" && !dataUnica) {
      setErro("Escolha a data do pagamento.");
      return;
    }
    if (resultado === "cancelado" && !motivo.trim()) {
      setErro("Diga o motivo do cancelamento (fica registrado).");
      return;
    }
    const acaoTexto =
      resultado === "pago"
        ? `marcar como ${verboPago}${dataModo === "unica" ? ` em ${dataBR(dataUnica)}` : " na data de vencimento de cada item"}`
        : "CANCELAR (não vai ser " + (modo === "pagar" ? "paga" : "recebida") + ")";
    if (!confirm(`${escolhidos.length} item(ns), ${fmtBRL(totalEscolhido)}.\nVocê vai ${acaoTexto}. Confirmar?`)) return;

    const lote: ItemParaResolver[] = escolhidos.map((i) => ({
      acao: i.acao!,
      descricao: i.descricao,
      valor: i.valor,
      vencimento: i.data,
    }));

    startTransition(async () => {
      const acumuladasFalhas: { descricao: string; message: string }[] = [];
      let feitos = 0;
      for (let inicio = 0; inicio < lote.length; inicio += POR_CHAMADA) {
        setProgresso(`Processando ${Math.min(inicio + POR_CHAMADA, lote.length)} de ${lote.length}…`);
        const r = await resolverPendencias({
          itens: lote.slice(inicio, inicio + POR_CHAMADA),
          resultado,
          data: resultado === "pago" && dataModo === "unica" ? dataUnica : "vencimento",
          motivo: resultado === "cancelado" ? motivo : null,
        });
        if (!r.ok) {
          setErro(r.message);
          break;
        }
        feitos += r.data.feitos;
        acumuladasFalhas.push(...r.data.falhas);
      }
      setFalhas(acumuladasFalhas);
      setProgresso(`${feitos} item(ns) resolvido(s)${acumuladasFalhas.length ? `, ${acumuladasFalhas.length} com problema` : ""}.`);
      setSelecao(new Set());
      router.refresh();
    });
  }

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
        <>
          <label className="mb-1 flex items-center gap-2 text-[12px] text-text-secondary">
            <input
              type="checkbox"
              checked={escolhidos.length === selecionaveis.length && selecionaveis.length > 0}
              onChange={(e) => setSelecao(e.target.checked ? new Set(selecionaveis.map(chaveDe)) : new Set())}
            />
            Selecionar todos
          </label>
          <div className="flex max-h-96 flex-col gap-1 overflow-y-auto pr-1">
            {itens.map((i) => {
              const chave = chaveDe(i);
              return (
                <label
                  key={chave}
                  className="flex cursor-pointer items-center justify-between gap-2 rounded-btn bg-card-secondary px-3 py-1.5 text-[12.5px]"
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      disabled={!i.acao}
                      checked={selecao.has(chave)}
                      onChange={() => alternar(chave)}
                    />
                    <span>
                      {i.descricao} <span className="text-text-muted">· {dataBR(i.data)}</span>
                    </span>
                  </span>
                  <span className="font-semibold">{fmtBRL(i.valor)}</span>
                </label>
              );
            })}
          </div>

          {escolhidos.length > 0 && (
            <div className="mt-2 flex flex-col gap-2 rounded-btn border border-border-gold p-3 text-[12.5px]">
              <p>
                <strong>{escolhidos.length}</strong> selecionado(s) · {fmtBRL(totalEscolhido)}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={dataModo}
                  onChange={(e) => setDataModo(e.target.value as "vencimento" | "unica")}
                  className="rounded-btn border border-border-neutral bg-card px-2 py-1"
                >
                  <option value="vencimento">Data = vencimento de cada item</option>
                  <option value="unica">Escolher uma data</option>
                </select>
                {dataModo === "unica" && (
                  <input
                    type="date"
                    value={dataUnica}
                    onChange={(e) => setDataUnica(e.target.value)}
                    className="rounded-btn border border-border-neutral bg-card px-2 py-1"
                  />
                )}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => aplicar("pago")}
                  className="rounded-btn bg-gold px-3 py-1.5 font-semibold text-bg disabled:opacity-60"
                >
                  Foi {verboPago}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Motivo (obrigatório pra cancelar)"
                  className="min-w-56 flex-1 rounded-btn border border-border-neutral bg-card px-2 py-1"
                />
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => aplicar("cancelado")}
                  className="rounded-btn border border-danger-border px-3 py-1.5 font-semibold text-danger disabled:opacity-60"
                >
                  Não vai ser {verboPago}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {progresso && <p className="mt-2 text-[12.5px] text-text-secondary">{progresso}</p>}
      {erro && <p className="mt-1 text-[12.5px] text-danger">{erro}</p>}
      {falhas.length > 0 && (
        <div className="mt-2 rounded-btn border border-danger-border p-2 text-[12px]">
          <p className="mb-1 font-semibold text-danger">Não foi possível resolver:</p>
          {falhas.map((f, i) => (
            <p key={i}>
              {f.descricao} — {f.message}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

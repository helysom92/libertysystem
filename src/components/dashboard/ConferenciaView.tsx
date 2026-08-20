"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { analisarExtrato, fecharMes, type AnaliseExtratoResultado } from "@/lib/actions/extrato";
import { createLancamento, deleteLancamento } from "@/lib/actions/financeiro";
import { fmtBRL } from "@/lib/domain/types";
import type { AchadoConciliacao } from "@/lib/domain/extrato";
import type { FechamentoMensal } from "@/lib/domain/types";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function AchadoFaltando({ achado, onLancado }: { achado: AchadoConciliacao; onLancado: () => void }) {
  const linha = achado.linhaExtrato!;
  const [categoria, setCategoria] = useState("Geral");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function lancar() {
    setError(null);
    startTransition(async () => {
      try {
        await createLancamento({
          tipo: linha.tipo,
          descricao: linha.descricao,
          categoria,
          valor: linha.valor,
          data: linha.data,
          status: "realizado",
        });
        onLancado();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível lançar.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-btn bg-card-secondary px-3 py-2 text-[12.5px]">
      <div>
        <p className="font-medium">{linha.descricao}</p>
        <p className="text-[11px] text-text-muted">
          {linha.data.split("-").reverse().join("/")} · {linha.tipo}
        </p>
        {error && <p className="text-[11px] text-danger">{error}</p>}
      </div>
      <div className="flex items-center gap-2">
        <input
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          className="w-28 rounded-btn border border-border-neutral bg-card px-2 py-1 text-[11.5px]"
          placeholder="Categoria"
        />
        <span className={`w-20 text-right font-semibold ${linha.tipo === "Despesa" ? "text-danger" : "text-success"}`}>
          {fmtBRL(linha.valor)}
        </span>
        <button
          type="button"
          onClick={lancar}
          disabled={pending}
          className="rounded-btn bg-gold px-2.5 py-1.5 text-[11.5px] font-semibold text-bg disabled:opacity-60"
        >
          {pending ? "Lançando..." : "Lançar"}
        </button>
      </div>
    </div>
  );
}

function AchadoDuplicata({ achado, onRemovido }: { achado: AchadoConciliacao; onRemovido: () => void }) {
  const sobrando = achado.lancamentoSobrando!;
  const original = achado.lancamentoOriginal!;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remover() {
    if (!confirm(`Remover o lançamento duplicado "${sobrando.descricao}" (${fmtBRL(sobrando.valor)})?`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteLancamento(sobrando.id);
        onRemovido();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível remover.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-btn bg-card-secondary px-3 py-2 text-[12.5px]">
      <div>
        <p className="font-medium">{original.descricao}</p>
        <p className="text-[11px] text-text-muted">
          Lançado em {original.data.split("-").reverse().join("/")} e {sobrando.data.split("-").reverse().join("/")} — {fmtBRL(original.valor)} cada
        </p>
        {error && <p className="text-[11px] text-danger">{error}</p>}
      </div>
      <button
        type="button"
        onClick={remover}
        disabled={pending}
        className="rounded-btn border border-danger-border px-2.5 py-1.5 text-[11.5px] font-semibold text-danger disabled:opacity-60"
      >
        {pending ? "Removendo..." : "Remover duplicata"}
      </button>
    </div>
  );
}

export default function ConferenciaView({ fechamentos }: { fechamentos: FechamentoMensal[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [meuNome, setMeuNome] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("liberty_meu_nome_extrato") ?? "" : ""
  );
  const [analise, setAnalise] = useState<AnaliseExtratoResultado | null>(null);
  const [mostrarInternas, setMostrarInternas] = useState(false);
  const [pending, startTransition] = useTransition();
  const [fechando, startFechando] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fechamentoRecente, setFechamentoRecente] = useState<{ entrou: number; saiu: number; lucro: number } | null>(null);

  const fechamentoDoMes = fechamentos.find((f) => f.ano === ano && f.mes === mes);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    localStorage.setItem("liberty_meu_nome_extrato", meuNome);
    setError(null);
    setAnalise(null);
    setFechamentoRecente(null);
    startTransition(async () => {
      try {
        const supabase = createClient();
        const path = `extratos/${ano}-${mes}/${crypto.randomUUID()}-${file.name}`;
        const { error: uploadErr } = await supabase.storage.from("arquivos").upload(path, file);
        if (uploadErr) throw uploadErr;
        const resultado = await analisarExtrato(path, ano, mes, meuNome);
        setAnalise(resultado);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível analisar esse extrato.");
      } finally {
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  }

  function removerAchado(achado: AchadoConciliacao) {
    if (!analise) return;
    setAnalise({
      ...analise,
      resultado: { ...analise.resultado, achados: analise.resultado.achados.filter((a) => a !== achado) },
    });
    router.refresh();
  }

  function handleFecharMes() {
    setError(null);
    startFechando(async () => {
      try {
        const r = await fecharMes(ano, mes);
        setFechamentoRecente(r);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível fechar o mês.");
      }
    });
  }

  const faltando = analise?.resultado.achados.filter((a) => a.tipo === "faltando") ?? [];
  const duplicatas = analise?.resultado.achados.filter((a) => a.tipo === "duplicata_provavel") ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-lg font-bold">Conferência de Extrato</h2>
        <p className="text-[13px] text-text-secondary">
          Suba o extrato do banco pra conferir contra os lançamentos e fechar o balanço do mês
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-card border border-border-neutral bg-card p-4">
        <div>
          <label className="mb-1 block text-xs text-text-secondary">Mês</label>
          <select
            value={mes}
            onChange={(e) => setMes(Number(e.target.value))}
            className="rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
          >
            {MESES.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-text-secondary">Ano</label>
          <input
            type="number"
            value={ano}
            onChange={(e) => setAno(Number(e.target.value))}
            className="w-24 rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
          />
        </div>
        <div className="flex-1 min-w-[220px]">
          <label className="mb-1 block text-xs text-text-secondary">Seu nome como aparece no extrato</label>
          <input
            value={meuNome}
            onChange={(e) => setMeuNome(e.target.value)}
            placeholder="Ex: Helysom Rodrigues Barbosa"
            className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-btn border border-border-gold-strong px-4 py-2 text-sm text-gold">
          {pending ? "Lendo extrato..." : "+ Subir Extrato (PDF)"}
          <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFile} disabled={pending} />
        </label>
      </div>

      {error && (
        <p className="rounded-btn border border-danger-border bg-card-secondary px-3 py-2 text-[12.5px] text-danger">{error}</p>
      )}

      {analise && (
        <>
          <div>
            <p className="mb-2 text-[10.5px] tracking-wide text-text-muted uppercase">
              🔴 Faltando lançar ({faltando.length})
            </p>
            <div className="flex flex-col gap-1.5">
              {faltando.map((a, i) => (
                <AchadoFaltando key={i} achado={a} onLancado={() => removerAchado(a)} />
              ))}
              {faltando.length === 0 && <p className="text-sm text-text-muted">Nada faltando — tudo já lançado.</p>}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[10.5px] tracking-wide text-text-muted uppercase">
              🟠 Duplicata provável ({duplicatas.length})
            </p>
            <div className="flex flex-col gap-1.5">
              {duplicatas.map((a, i) => (
                <AchadoDuplicata key={i} achado={a} onRemovido={() => removerAchado(a)} />
              ))}
              {duplicatas.length === 0 && <p className="text-sm text-text-muted">Nenhuma duplicata encontrada.</p>}
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setMostrarInternas(!mostrarInternas)}
              className="mb-2 text-[10.5px] tracking-wide text-text-muted uppercase hover:text-text"
            >
              ⚪ Movimentação interna ({analise.resultado.internas.length}) {mostrarInternas ? "▲" : "▼"}
            </button>
            {mostrarInternas && (
              <div className="flex flex-col gap-1">
                {analise.resultado.internas.map((l, i) => (
                  <p key={i} className="rounded-btn bg-card-secondary px-3 py-1.5 text-[12px] text-text-muted">
                    {l.data.split("-").reverse().join("/")} · {l.descricao} · {fmtBRL(l.valor)}
                  </p>
                ))}
              </div>
            )}
          </div>

          <p className="text-[12px] text-text-muted">
            {analise.resultado.batendo} de {analise.totalLinhas} linhas do extrato já batem com o sistema.
          </p>
        </>
      )}

      <div className="rounded-card border border-border-gold bg-card p-4">
        {fechamentoDoMes && !fechamentoRecente ? (
          <p className="text-sm">
            ✓ {MESES[mes - 1]}/{ano} fechado em {new Date(fechamentoDoMes.fechado_em).toLocaleDateString("pt-BR")} —{" "}
            Entrou {fmtBRL(fechamentoDoMes.entrou)} · Saiu {fmtBRL(fechamentoDoMes.saiu)} · Lucro {fmtBRL(fechamentoDoMes.lucro)}
          </p>
        ) : fechamentoRecente ? (
          <p className="text-sm">
            ✓ {MESES[mes - 1]}/{ano} fechado agora — Entrou {fmtBRL(fechamentoRecente.entrou)} · Saiu{" "}
            {fmtBRL(fechamentoRecente.saiu)} · Lucro {fmtBRL(fechamentoRecente.lucro)}
          </p>
        ) : (
          <button
            type="button"
            onClick={handleFecharMes}
            disabled={fechando}
            className="rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-4 py-2 text-sm font-semibold text-bg disabled:opacity-60"
          >
            {fechando ? "Fechando..." : `Fechar ${MESES[mes - 1]}/${ano}`}
          </button>
        )}
      </div>

      {fechamentos.length > 0 && (
        <div>
          <p className="mb-2 text-[10.5px] tracking-wide text-text-muted uppercase">Meses já fechados</p>
          <div className="flex flex-col gap-1">
            {fechamentos.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between rounded-btn bg-card-secondary px-3 py-2 text-[12.5px]"
              >
                <span>{MESES[f.mes - 1]}/{f.ano}</span>
                <span className="text-text-muted">
                  Entrou {fmtBRL(f.entrou)} · Saiu {fmtBRL(f.saiu)} · Lucro {fmtBRL(f.lucro)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

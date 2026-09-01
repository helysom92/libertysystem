"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ContaPessoal } from "@/lib/domain/types";
import { fmtBRL } from "@/lib/domain/types";
import { fmtDatePtBR } from "@/lib/domain/dates";
import type { LinhaExtratoPessoal } from "@/lib/domain/extratoPessoal";
import { analisarExtratoPessoal, importarReceitaRealizada, importarDespesaRealizada } from "@/lib/actions/financasPessoaisImportacao";

interface LinhaPendente extends LinhaExtratoPessoal {
  chaveLocal: string;
  contaId: string;
  categoria: string;
}

export default function ImportacoesClient({ contas }: { contas: ContaPessoal[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendentes, setPendentes] = useState<LinhaPendente[]>([]);
  const [totalOriginal, setTotalOriginal] = useState(0);
  const [lendo, startLendo] = useTransition();
  const [processando, setProcessando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setPendentes([]);
    startLendo(async () => {
      try {
        const supabase = createClient();
        const path = `extratos/${crypto.randomUUID()}-${file.name}`;
        const { error: uploadErr } = await supabase.storage.from("financas-pessoais").upload(path, file);
        if (uploadErr) throw uploadErr;
        const resultado = await analisarExtratoPessoal(path);
        if (!resultado.ok) {
          setError(resultado.message);
          return;
        }
        const linhas = resultado.data.map((l, i) => ({
          ...l,
          chaveLocal: `${i}-${l.data}-${l.valor}`,
          contaId: contas[0]?.id ?? "",
          categoria: "",
        }));
        setPendentes(linhas);
        setTotalOriginal(linhas.length);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível ler esse extrato.");
      } finally {
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  }

  function atualizarLinha(chave: string, campo: "contaId" | "categoria", valor: string) {
    setPendentes((ls) => ls.map((l) => (l.chaveLocal === chave ? { ...l, [campo]: valor } : l)));
  }

  function ignorar(chave: string) {
    setPendentes((ls) => ls.filter((l) => l.chaveLocal !== chave));
  }

  function registrar(linha: LinhaPendente, tipo: "Receita" | "Despesa") {
    if (!linha.contaId) {
      setError("Selecione uma conta antes de registrar essa linha.");
      return;
    }
    setError(null);
    setProcessando(linha.chaveLocal);
    const input = {
      descricao: linha.descricao,
      categoria: linha.categoria.trim() || null,
      valor: linha.valor,
      data: linha.data,
      contaId: linha.contaId,
    };
    const acao = tipo === "Receita" ? importarReceitaRealizada : importarDespesaRealizada;
    acao(input).then((resultado) => {
      setProcessando(null);
      if (!resultado.ok) {
        setError(resultado.message);
        return;
      }
      setPendentes((ls) => ls.filter((l) => l.chaveLocal !== linha.chaveLocal));
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-xl font-bold">Importações</h1>
        <p className="text-[13px] text-text-secondary">
          Suba o PDF de um extrato — a IA lê as linhas, mas nada é salvo sozinho: você confirma uma por uma.
        </p>
      </div>

      <div className="mb-5 rounded-card border border-border-neutral bg-card p-4">
        <label className="flex w-fit cursor-pointer items-center gap-2 rounded-btn border border-border-gold-strong px-4 py-2 text-sm text-gold">
          {lendo ? "Lendo extrato..." : "+ Subir Extrato (PDF)"}
          <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFile} disabled={lendo || contas.length === 0} />
        </label>
        {contas.length === 0 && (
          <p className="mt-2 text-[12px] text-danger">Cadastre pelo menos uma conta antes de importar um extrato.</p>
        )}
      </div>

      {error && (
        <p className="mb-4 rounded-btn border border-danger-border bg-card px-3 py-2 text-[12.5px] text-danger">{error}</p>
      )}

      {totalOriginal > 0 && (
        <p className="mb-3 text-[12px] text-text-muted">
          {totalOriginal - pendentes.length} de {totalOriginal} linhas já revisadas.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {pendentes.map((l) => (
          <div key={l.chaveLocal} className="rounded-card border border-border-neutral bg-card p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[13px] font-semibold text-text">{l.descricao}</p>
                <p className="text-[11.5px] text-text-muted">{fmtDatePtBR(l.data)}</p>
              </div>
              <p className={`text-[14px] font-semibold ${l.tipo === "Despesa" ? "text-danger" : "text-success"}`}>
                {l.tipo === "Despesa" ? "− " : "+ "}
                {fmtBRL(l.valor)}
              </p>
            </div>
            <div className="mb-2 flex flex-wrap gap-2">
              <select
                value={l.contaId}
                onChange={(e) => atualizarLinha(l.chaveLocal, "contaId", e.target.value)}
                className="rounded-btn border border-border-neutral bg-card-secondary px-2 py-1.5 text-[12.5px]"
              >
                {contas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
              <input
                value={l.categoria}
                onChange={(e) => atualizarLinha(l.chaveLocal, "categoria", e.target.value)}
                placeholder="Categoria (opcional)"
                className="flex-1 rounded-btn border border-border-neutral bg-card-secondary px-2 py-1.5 text-[12.5px]"
              />
            </div>
            <div className="flex flex-wrap gap-2 text-[12px]">
              <button
                type="button"
                onClick={() => registrar(l, "Receita")}
                disabled={processando === l.chaveLocal}
                style={{ borderColor: "var(--color-success)" }}
                className="rounded-btn border px-2.5 py-1.5 font-semibold text-success disabled:opacity-50"
              >
                Registrar como Receita
              </button>
              <button
                type="button"
                onClick={() => registrar(l, "Despesa")}
                disabled={processando === l.chaveLocal}
                className="rounded-btn border border-danger-border px-2.5 py-1.5 font-semibold text-danger disabled:opacity-50"
              >
                Registrar como Despesa
              </button>
              <button
                type="button"
                onClick={() => ignorar(l.chaveLocal)}
                disabled={processando === l.chaveLocal}
                className="rounded-btn px-2.5 py-1.5 text-text-muted hover:text-text disabled:opacity-50"
              >
                Ignorar
              </button>
            </div>
          </div>
        ))}
        {totalOriginal > 0 && pendentes.length === 0 && (
          <p className="rounded-card border border-border-neutral bg-card p-4 text-center text-[13px] text-success">
            Tudo revisado 🎉
          </p>
        )}
      </div>
    </div>
  );
}

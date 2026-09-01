"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ContaPessoal } from "@/lib/domain/types";
import { fmtBRL } from "@/lib/domain/types";
import { fmtDatePtBR } from "@/lib/domain/dates";
import type { LinhaExtratoPessoal } from "@/lib/domain/extratoPessoal";
import { parseCsvExtrato } from "@/lib/domain/csvExtrato";
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
  const [avisos, setAvisos] = useState<string[]>([]);
  const [textoColado, setTextoColado] = useState("");

  function popularPendentes(linhasLidas: LinhaExtratoPessoal[]) {
    const linhas = linhasLidas.map((l, i) => ({
      ...l,
      chaveLocal: `${i}-${l.data}-${l.valor}-${l.descricao}`,
      contaId: contas[0]?.id ?? "",
      categoria: "",
    }));
    setPendentes(linhas);
    setTotalOriginal(linhas.length);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setAvisos([]);
    setPendentes([]);
    setTotalOriginal(0);

    const ehCsv = file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv";

    if (ehCsv) {
      // Leitura 100% local — sem IA, sem upload, sem depender de nenhuma chave de API.
      startLendo(async () => {
        try {
          const texto = await file.text();
          const { linhas, erros } = parseCsvExtrato(texto);
          if (linhas.length === 0 && erros.length > 0) {
            setError(erros[0]);
            return;
          }
          setAvisos(erros);
          popularPendentes(linhas);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Não foi possível ler esse CSV.");
        } finally {
          if (inputRef.current) inputRef.current.value = "";
        }
      });
      return;
    }

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
        popularPendentes(resultado.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível ler esse extrato.");
      } finally {
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  }

  function processarTextoColado() {
    setError(null);
    setAvisos([]);
    setPendentes([]);
    setTotalOriginal(0);
    const { linhas, erros } = parseCsvExtrato(textoColado);
    if (linhas.length === 0 && erros.length > 0) {
      setError(erros[0]);
      return;
    }
    setAvisos(erros);
    popularPendentes(linhas);
    setTextoColado("");
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
          Suba um extrato em CSV (leitura local, sem IA) ou PDF (lido por IA) — nada é salvo sozinho: você confirma cada linha.
        </p>
      </div>

      <div className="mb-5 rounded-card border border-border-neutral bg-card p-4">
        <label className="flex w-fit cursor-pointer items-center gap-2 rounded-btn border border-border-gold-strong px-4 py-2 text-sm text-gold">
          {lendo ? "Lendo extrato..." : "+ Subir Extrato (CSV ou PDF)"}
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv,application/pdf"
            className="hidden"
            onChange={handleFile}
            disabled={lendo || contas.length === 0}
          />
        </label>
        {contas.length === 0 && (
          <p className="mt-2 text-[12px] text-danger">Cadastre pelo menos uma conta antes de importar um extrato.</p>
        )}
      </div>

      <div className="mb-5 rounded-card border border-border-neutral bg-card p-4">
        <p className="mb-2 text-[12px] font-semibold text-text-secondary">Ou cole o texto do extrato (CSV) direto aqui</p>
        <textarea
          value={textoColado}
          onChange={(e) => setTextoColado(e.target.value)}
          placeholder={"Data;Descricao;Valor\n01/09/2026;Mercado;-150,00"}
          rows={4}
          className="mb-2 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 font-mono text-[12px]"
        />
        <button
          type="button"
          onClick={processarTextoColado}
          disabled={!textoColado.trim() || contas.length === 0}
          className="rounded-btn border border-border-gold-strong px-4 py-2 text-sm text-gold disabled:opacity-40"
        >
          Processar texto colado
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-btn border border-danger-border bg-card px-3 py-2 text-[12.5px] text-danger">{error}</p>
      )}

      {avisos.length > 0 && (
        <div className="mb-4 rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-[12px] text-text-secondary">
          <p className="mb-1 font-semibold text-text-muted">{avisos.length} linha(s) não puderam ser lidas e foram puladas:</p>
          {avisos.map((a, i) => (
            <p key={i}>{a}</p>
          ))}
        </div>
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

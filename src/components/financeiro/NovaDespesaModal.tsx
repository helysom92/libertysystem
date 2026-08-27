"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DespesaFixa, DespesaVariavel, Fornecedor, ServicoParaVinculo } from "@/lib/domain/types";
import { todayISO } from "@/lib/domain/dates";
import { lancarDespesaExistente, lancarDespesaParcelada, lancarNovaDespesa } from "@/lib/actions/financeiro";

function normalizar(s: string) {
  // ignora acento — "Combustível" e "combustivel" batem com a mesma despesa cadastrada
  return s.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

const CATEGORIAS_CUSTO_DIRETO = [
  "Impressão terceirizada",
  "Lona e adesivo",
  "PVC, ACM, metalon e acrílico",
  "Frete do material",
  "Instalação terceirizada",
  "Comissão sobre a venda",
  "Taxa da maquininha",
  "Impostos sobre faturamento",
];

function servicoLabel(s: ServicoParaVinculo) {
  return `${s.numero} — ${s.cliente} — ${s.descricao}`;
}

export default function NovaDespesaModal({
  fornecedores,
  despesasFixas,
  despesasVariaveis,
  servicos,
  onClose,
}: {
  fornecedores: Fornecedor[];
  despesasFixas: DespesaFixa[];
  despesasVariaveis: DespesaVariavel[];
  servicos: ServicoParaVinculo[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [tipo, setTipo] = useState<"fixa" | "variavel" | "parcelada">("fixa");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("Geral");
  const [fornecedorId, setFornecedorId] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(todayISO());
  const [totalParcelas, setTotalParcelas] = useState("2");
  const [primeiraPaga, setPrimeiraPaga] = useState(true);
  const [servicoTexto, setServicoTexto] = useState("");
  const [confirmaNova, setConfirmaNova] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const servicoVinculado = servicos.find((s) => servicoLabel(s) === servicoTexto) ?? null;

  const opcoesExistentes = tipo === "fixa" ? despesasFixas : tipo === "variavel" ? despesasVariaveis : [];
  // Basta o nome digitado bater com uma despesa já cadastrada (desse mesmo tipo) — sem
  // precisar de um seletor separado, é só digitar ou escolher da sugestão do campo.
  // Parcelada é sempre uma compra nova, sem catálogo de recorrentes.
  const existente = opcoesExistentes.find((d) => normalizar(d.descricao) === normalizar(descricao));

  function limparCampos() {
    setDescricao("");
    setCategoria("Geral");
    setFornecedorId("");
    setValor("");
    setTotalParcelas("2");
    setPrimeiraPaga(true);
    setServicoTexto("");
    setConfirmaNova(false);
  }

  function selecionarTipo(t: "fixa" | "variavel" | "parcelada") {
    setTipo(t);
    limparCampos();
  }

  function handleDescricaoChange(value: string) {
    setDescricao(value);
    setConfirmaNova(false);
    const match = opcoesExistentes.find((d) => normalizar(d.descricao) === normalizar(value));
    if (match) {
      setCategoria(match.categoria ?? "Geral");
      setFornecedorId(match.fornecedor_id ?? "");
      setValor(String("valor" in match ? match.valor : match.valor_provisionado));
    }
  }

  const criandoNovaRecorrente = tipo !== "parcelada" && descricao.trim() !== "" && !existente;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!descricao.trim()) {
      setError("Dê um nome pra despesa.");
      return;
    }
    if (criandoNovaRecorrente && !confirmaNova) {
      setError('Marque a confirmação de que "' + descricao + '" é mesmo uma despesa recorrente nova antes de lançar.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (tipo === "parcelada") {
        await lancarDespesaParcelada({
          descricao,
          categoria,
          fornecedor_id: fornecedorId || null,
          valorParcela: Number(valor) || 0,
          totalParcelas: Number(totalParcelas) || 1,
          primeiraData: data,
          primeiraPaga,
          servico_id: servicoVinculado?.id ?? null,
        });
      } else if (existente) {
        await lancarDespesaExistente({ tipo, despesaId: existente.id, valor: Number(valor) || 0, data });
      } else {
        await lancarNovaDespesa({
          tipo,
          descricao,
          categoria,
          fornecedor_id: fornecedorId || null,
          valor: Number(valor) || 0,
          data,
        });
      }
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível lançar essa despesa.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-card border border-border-gold bg-card p-6"
      >
        <h2 className="mb-4 font-display text-lg font-bold">Nova Despesa</h2>

        <div className="mb-3 flex gap-2">
          {(["fixa", "variavel", "parcelada"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => selecionarTipo(t)}
              className={`flex-1 rounded-btn border py-2 text-sm capitalize ${
                tipo === t ? "border-gold bg-gold/10 text-gold" : "border-border-neutral text-text-secondary"
              }`}
            >
              {t === "fixa" ? "Fixa (repete todo mês)" : t === "variavel" ? "Variável (valor muda)" : "Parcelada (N vezes)"}
            </button>
          ))}
        </div>

        <label className="mb-1 block text-xs text-text-secondary">
          {tipo === "parcelada" ? "Descrição da compra" : "Descrição — digite um nome novo ou escolha uma já cadastrada"}
        </label>
        <input
          value={descricao}
          onChange={(e) => handleDescricaoChange(e.target.value)}
          list={tipo === "parcelada" ? undefined : "despesas-existentes"}
          placeholder={tipo === "parcelada" ? "Ex: Parafusadeira, Compressor..." : "Ex: Aluguel, Água, Combustível..."}
          className="mb-1 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
        />
        {tipo !== "parcelada" && (
          <datalist id="despesas-existentes">
            {opcoesExistentes.map((d) => (
              <option key={d.id} value={d.descricao} />
            ))}
          </datalist>
        )}
        {existente && (
          <p className="mb-2 text-[11px] text-gold">
            Já cadastrada — vai lançar a ocorrência dessa data pra ela, sem duplicar.
          </p>
        )}
        {criandoNovaRecorrente && (
          <div className="mb-2 rounded-btn border border-danger-border bg-card-secondary px-3 py-2">
            <p className="mb-1.5 text-[11.5px] text-danger">
              &ldquo;{descricao}&rdquo; ainda não existe — isso vai criar uma despesa {tipo === "fixa" ? "fixa" : "variável"} NOVA,
              que repete todo mês. Se foi uma compra avulsa/única, cancele e use a aba &ldquo;Parcelada&rdquo; em vez disso.
            </p>
            <label className="flex items-center gap-2 text-[11.5px] text-text">
              <input type="checkbox" checked={confirmaNova} onChange={(e) => setConfirmaNova(e.target.checked)} />
              Confirmo que é mesmo uma despesa recorrente nova
            </label>
          </div>
        )}
        <div className="mb-3" />

        <div className="mb-3 flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">
              {tipo === "parcelada" ? "Valor de cada parcela" : "Valor"}
            </label>
            <input
              type="number"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              disabled={!!existente && tipo === "fixa"}
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm disabled:opacity-60"
            />
          </div>
          {tipo === "parcelada" && (
            <div className="flex-1">
              <label className="mb-1 block text-xs text-text-secondary">Quantas parcelas</label>
              <input
                type="number"
                min={1}
                value={totalParcelas}
                onChange={(e) => setTotalParcelas(e.target.value)}
                className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
              />
            </div>
          )}
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">
              {tipo === "parcelada" ? "Data da 1ª parcela" : tipo === "fixa" && !existente ? "Data (define o dia de vencimento)" : "Data"}
            </label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            />
          </div>
        </div>
        {tipo === "parcelada" && (
          <label className="mb-3 flex items-center gap-2 text-[12.5px]">
            <input type="checkbox" checked={primeiraPaga} onChange={(e) => setPrimeiraPaga(e.target.checked)} />
            Já paguei a 1ª parcela
          </label>
        )}

        {tipo === "parcelada" && (
          <div className="mb-3">
            <label className="mb-1 block text-xs text-text-secondary">Vincular a uma Ordem de Serviço (opcional)</label>
            <input
              value={servicoTexto}
              onChange={(e) => setServicoTexto(e.target.value)}
              list="servicos-vinculo"
              placeholder="Digite o número, cliente ou descrição da OS..."
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            />
            <datalist id="servicos-vinculo">
              {servicos.map((s) => (
                <option key={s.id} value={servicoLabel(s)} />
              ))}
            </datalist>
            <p className="mt-1 text-[11px] text-text-muted">
              Use aqui pra custos de um serviço específico — lona, terceirização, frete, instalação, comissão, etc.
            </p>
          </div>
        )}

        <div className="mb-4 flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Categoria</label>
            <input
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              disabled={!!existente}
              list={tipo === "parcelada" ? "categorias-custo-direto" : undefined}
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm disabled:opacity-60"
            />
            {tipo === "parcelada" && (
              <datalist id="categorias-custo-direto">
                {CATEGORIAS_CUSTO_DIRETO.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            )}
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Fornecedor</label>
            <select
              value={fornecedorId}
              onChange={(e) => setFornecedorId(e.target.value)}
              disabled={!!existente}
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm disabled:opacity-60"
            >
              <option value="">—</option>
              {fornecedores.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="mb-3 text-sm text-danger">{error}</p>}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-btn px-4 py-2 text-sm text-text-secondary hover:text-text"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-4 py-2 text-sm font-semibold text-bg disabled:opacity-60"
          >
            {saving ? "Lançando..." : "Lançar"}
          </button>
        </div>
      </form>
    </div>
  );
}

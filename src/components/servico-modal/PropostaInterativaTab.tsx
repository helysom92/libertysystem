"use client";

import { useState } from "react";
import type { ServicoDetail } from "@/lib/domain/types";
import { LINHA_ORCAMENTO_INFO, type LinhaOrcamento } from "@/lib/domain/orcamento";
import { salvarPropostaOpcoes, type PropostaOpcaoInput } from "@/lib/actions/propostaOpcoes";
import { ensureShareToken } from "@/lib/actions/servicos";
import { whatsappAppUrl } from "@/lib/domain/whatsapp";

const LINHAS = Object.keys(LINHA_ORCAMENTO_INFO) as LinhaOrcamento[];

interface OpcaoForm {
  titulo: string;
  descricao: string;
  valor: string;
}

function opcoesIniciais(detail: ServicoDetail): Record<LinhaOrcamento, OpcaoForm> {
  const porLinha = new Map(detail.propostaOpcoes.map((o) => [o.linha, o]));
  const result = {} as Record<LinhaOrcamento, OpcaoForm>;
  for (const linha of LINHAS) {
    const existente = porLinha.get(linha);
    result[linha] = {
      titulo: existente?.titulo ?? LINHA_ORCAMENTO_INFO[linha].label,
      descricao: existente?.descricao ?? "",
      valor: existente ? String(existente.valor) : "",
    };
  }
  return result;
}

export default function PropostaInterativaTab({
  detail,
  onChanged,
}: {
  detail: ServicoDetail;
  onChanged: () => void;
}) {
  const { servico } = detail;
  const [opcoes, setOpcoes] = useState<Record<LinhaOrcamento, OpcaoForm>>(() => opcoesIniciais(detail));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviarError, setEnviarError] = useState<string | null>(null);

  function setCampo(linha: LinhaOrcamento, campo: keyof OpcaoForm, valor: string) {
    setOpcoes((prev) => ({ ...prev, [linha]: { ...prev[linha], [campo]: valor } }));
    setDirty(true);
  }

  const prontoPraEnviar = LINHAS.every((l) => opcoes[l].titulo.trim() && Number(opcoes[l].valor) > 0);

  async function salvar() {
    setSaving(true);
    setError(null);
    try {
      const payload: PropostaOpcaoInput[] = LINHAS.map((linha, ordem) => ({
        linha,
        titulo: opcoes[linha].titulo.trim() || LINHA_ORCAMENTO_INFO[linha].label,
        descricao: opcoes[linha].descricao.trim() || null,
        valor: Number(opcoes[linha].valor) || 0,
        ordem,
      }));
      await salvarPropostaOpcoes(servico.id, payload);
      setDirty(false);
      onChanged();
    } catch (err) {
      console.error("Falha ao salvar proposta interativa", err);
      setError(err instanceof Error ? err.message : "Não foi possível salvar as opções.");
    } finally {
      setSaving(false);
    }
  }

  async function enviar() {
    setEnviando(true);
    setEnviarError(null);
    try {
      if (dirty) await salvar();
      const token = await ensureShareToken(servico.id);
      const link = `${window.location.origin}/proposta-interativa/${token}`;
      const texto = `Olá ${detail.cliente.nome.split(" ")[0]}! Preparei 3 opções pra você escolher na proposta da Liberty Visual e Marketing: ${link}`;
      window.open(whatsappAppUrl(detail.cliente.whatsapp, texto), "_blank");
    } catch (err) {
      console.error("Falha ao enviar proposta interativa", err);
      setEnviarError(err instanceof Error ? err.message : "Não foi possível gerar o link da proposta.");
    } finally {
      setEnviando(false);
    }
  }

  const escolhida = servico.proposta_opcao_escolhida;
  const foiEnviada = detail.propostaOpcoes.length > 0;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[10.5px] tracking-wide text-text-muted uppercase">
        Proposta interativa — o cliente escolhe entre as 3 opções pelo link
      </p>

      {escolhida ? (
        <div
          className="rounded-card border p-3 text-[13px] font-semibold"
          style={{
            borderColor: LINHA_ORCAMENTO_INFO[escolhida].ring,
            backgroundColor: `${LINHA_ORCAMENTO_INFO[escolhida].ring}22`,
            color: LINHA_ORCAMENTO_INFO[escolhida].ring,
          }}
        >
          ✓ Cliente escolheu: {LINHA_ORCAMENTO_INFO[escolhida].label}
          {servico.proposta_escolhida_em && (
            <span className="ml-1 font-normal">
              — {new Date(servico.proposta_escolhida_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
            </span>
          )}
        </div>
      ) : (
        foiEnviada && (
          <p className="rounded-card border border-border-neutral bg-card-secondary p-3 text-[12.5px] text-text-muted">
            Aguardando resposta do cliente.
          </p>
        )
      )}

      {LINHAS.map((linha) => (
        <div
          key={linha}
          className="rounded-card border p-3"
          style={{ borderColor: `${LINHA_ORCAMENTO_INFO[linha].ring}55` }}
        >
          <p className="mb-2 text-[11px] font-bold uppercase" style={{ color: LINHA_ORCAMENTO_INFO[linha].ring }}>
            {LINHA_ORCAMENTO_INFO[linha].label}
          </p>
          <label className="mb-1 block text-xs text-text-secondary">Título</label>
          <input
            value={opcoes[linha].titulo}
            onChange={(e) => setCampo(linha, "titulo", e.target.value)}
            className="mb-2 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
          />
          <label className="mb-1 block text-xs text-text-secondary">Descrição</label>
          <textarea
            value={opcoes[linha].descricao}
            onChange={(e) => setCampo(linha, "descricao", e.target.value)}
            rows={2}
            placeholder="O que está incluso nessa opção..."
            className="mb-2 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
          />
          <label className="mb-1 block text-xs text-text-secondary">Valor (R$)</label>
          <input
            type="number"
            step="0.01"
            value={opcoes[linha].valor}
            onChange={(e) => setCampo(linha, "valor", e.target.value)}
            className="w-40 rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
          />
        </div>
      ))}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={salvar}
          disabled={!dirty || saving}
          className="w-fit rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-3 py-1.5 text-[12.5px] font-semibold text-bg disabled:opacity-40"
        >
          {saving ? "Salvando..." : "Salvar opções"}
        </button>
        {error && <p className="text-[12px] text-danger">Não foi possível salvar: {error}</p>}
      </div>

      <div className="flex items-center gap-3 border-t border-border-neutral pt-3">
        <button
          type="button"
          onClick={enviar}
          disabled={!prontoPraEnviar || enviando}
          className="rounded-btn border border-border-neutral px-3 py-1.5 text-[12.5px] disabled:opacity-40"
          style={{ color: "#25D366" }}
        >
          {enviando ? "Gerando link..." : "📲 Enviar Proposta Interativa"}
        </button>
        {!prontoPraEnviar && (
          <span className="text-[11.5px] text-text-muted">Preencha título e valor das 3 opções pra enviar.</span>
        )}
      </div>
      {enviarError && <p className="text-[12px] text-danger">{enviarError}</p>}
    </div>
  );
}

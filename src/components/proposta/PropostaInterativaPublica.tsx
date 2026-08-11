"use client";

import { useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { fmtBRL } from "@/lib/domain/types";
import { LINHA_ORCAMENTO_INFO, type LinhaOrcamento } from "@/lib/domain/orcamento";
import type { PropostaInterativaOpcaoPublica } from "@/app/proposta-interativa/[token]/page";

interface Props {
  token: string;
  proposta: {
    servico: {
      numero: string | null;
      descricao: string;
      criado_em: string;
      proposta_opcao_escolhida: LinhaOrcamento | null;
      proposta_escolhida_em: string | null;
    };
    cliente: { nome: string };
    opcoes: PropostaInterativaOpcaoPublica[];
  };
}

export default function PropostaInterativaPublica({ token, proposta }: Props) {
  const [escolhida, setEscolhida] = useState<LinhaOrcamento | null>(
    proposta.servico.proposta_opcao_escolhida
  );
  const [enviando, setEnviando] = useState<LinhaOrcamento | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function escolher(linha: LinhaOrcamento) {
    setEnviando(linha);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc("escolher_proposta", {
        p_token: token,
        p_linha: linha,
      });
      if (rpcError) throw rpcError;
      const result = data as { ok: boolean; reason?: string };
      if (!result.ok) {
        setError(result.reason ?? "Não foi possível registrar sua escolha.");
        return;
      }
      setEscolhida(linha);
    } catch (err) {
      console.error("Falha ao escolher proposta", err);
      setError("Não foi possível registrar sua escolha. Tente novamente.");
    } finally {
      setEnviando(null);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <Image src="/liberty-logo.png" alt="Liberty" width={180} height={50} priority className="h-9 w-auto object-contain" />
        <div>
          <h1 className="font-display text-xl font-bold text-text">Proposta de Orçamento</h1>
          <p className="text-[13px] text-text-secondary">
            Para {proposta.cliente.nome}
            {proposta.servico.numero ? ` · Nº ${proposta.servico.numero}` : ""}
          </p>
        </div>
        {proposta.servico.descricao && (
          <p className="max-w-xl text-[13px] text-text-secondary">{proposta.servico.descricao}</p>
        )}
      </div>

      {escolhida ? (
        <div
          className="mx-auto w-full max-w-md rounded-card border p-6 text-center"
          style={{
            borderColor: LINHA_ORCAMENTO_INFO[escolhida].ring,
            backgroundColor: `${LINHA_ORCAMENTO_INFO[escolhida].ring}18`,
          }}
        >
          <p className="mb-1 text-[24px]">✓</p>
          <p className="font-display text-lg font-bold text-text">
            Você escolheu: {LINHA_ORCAMENTO_INFO[escolhida].label}
          </p>
          <p className="mt-2 text-[13px] text-text-secondary">
            Obrigado! Vamos entrar em contato pra combinar os próximos passos.
          </p>
        </div>
      ) : proposta.opcoes.length === 0 ? (
        <p className="text-center text-[13px] text-text-secondary">
          Essa proposta ainda está sendo preparada. Fale com a Liberty pra mais detalhes.
        </p>
      ) : (
        <>
          <p className="text-center text-[13px] text-text-secondary">
            Escolha a opção que melhor atende você:
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {proposta.opcoes.map((opcao) => (
              <div
                key={opcao.linha}
                className="flex flex-col rounded-card border p-5"
                style={{ borderColor: `${LINHA_ORCAMENTO_INFO[opcao.linha].ring}66` }}
              >
                <p
                  className="mb-1 text-[11px] font-bold tracking-wide uppercase"
                  style={{ color: LINHA_ORCAMENTO_INFO[opcao.linha].ring }}
                >
                  {LINHA_ORCAMENTO_INFO[opcao.linha].label}
                </p>
                <p className="mb-2 font-display text-lg font-bold text-text">{opcao.titulo}</p>
                {opcao.descricao && (
                  <p className="mb-4 flex-1 text-[12.5px] text-text-secondary">{opcao.descricao}</p>
                )}
                <p className="mb-4 font-display text-2xl font-bold text-gradient-gold">
                  {fmtBRL(opcao.valor)}
                </p>
                <button
                  type="button"
                  onClick={() => escolher(opcao.linha)}
                  disabled={enviando !== null}
                  className="rounded-btn px-4 py-2.5 text-sm font-semibold text-bg disabled:opacity-50"
                  style={{ background: LINHA_ORCAMENTO_INFO[opcao.linha].ring }}
                >
                  {enviando === opcao.linha ? "Enviando..." : "Escolher esta opção"}
                </button>
              </div>
            ))}
          </div>
          {error && <p className="text-center text-[13px] text-danger">{error}</p>}
        </>
      )}
    </div>
  );
}

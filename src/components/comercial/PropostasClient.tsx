"use client";

import { useState } from "react";
import { LINHA_ORCAMENTO_INFO } from "@/lib/domain/orcamento";
import { displayNumero, fmtBRL, type ItemOrcamento, type Servico } from "@/lib/domain/types";
import type { Role } from "@/lib/domain/flows";
import type { Coluna } from "@/lib/domain/kanban";
import CentralDoServico from "@/components/servico-modal/CentralDoServico";

export default function PropostasClient({
  servicos,
  opcoesCountBySvId,
  colunas,
  role,
  itensOrcamento,
}: {
  servicos: Servico[];
  opcoesCountBySvId: Record<string, number>;
  colunas: Coluna[];
  role: Role;
  itensOrcamento: ItemOrcamento[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-xl font-bold">Propostas</h1>
        <p className="text-[13px] text-text-secondary">Todo serviço com link de proposta já gerado</p>
      </div>

      <div className="overflow-x-auto rounded-card border border-border-neutral">
        <table className="w-full min-w-[640px] text-left text-[13px]">
          <thead className="bg-card-secondary text-[11px] tracking-wide text-text-muted uppercase">
            <tr>
              <th className="px-3 py-2.5">Nº</th>
              <th className="px-3 py-2.5">Cliente</th>
              <th className="px-3 py-2.5">Descrição</th>
              <th className="px-3 py-2.5">Valor</th>
              <th className="px-3 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {servicos.map((s) => {
              const opcoesCount = opcoesCountBySvId[s.id] ?? 0;
              const escolhida = s.proposta_opcao_escolhida;
              return (
                <tr
                  key={s.id}
                  onClick={() => setOpenId(s.id)}
                  className="cursor-pointer border-t border-border-neutral hover:bg-card-secondary"
                >
                  <td className="px-3 py-2.5 font-semibold text-gold">{displayNumero(s)}</td>
                  <td className="px-3 py-2.5">{s.cliente}</td>
                  <td className="max-w-[260px] truncate px-3 py-2.5 text-text-secondary">{s.descricao}</td>
                  <td className="px-3 py-2.5 text-text-secondary">{fmtBRL(s.valor)}</td>
                  <td className="px-3 py-2.5">
                    {escolhida ? (
                      <span
                        className="rounded-pill px-2 py-0.5 text-[10.5px] font-semibold"
                        style={{
                          color: LINHA_ORCAMENTO_INFO[escolhida].ring,
                          backgroundColor: `${LINHA_ORCAMENTO_INFO[escolhida].ring}22`,
                        }}
                      >
                        ✓ Escolheu {LINHA_ORCAMENTO_INFO[escolhida].label}
                        {s.proposta_escolhida_em &&
                          ` — ${new Date(s.proposta_escolhida_em).toLocaleDateString("pt-BR")}`}
                      </span>
                    ) : opcoesCount > 0 ? (
                      <span className="rounded-pill border border-border-neutral px-2 py-0.5 text-[10.5px] text-text-secondary">
                        Aguardando resposta
                      </span>
                    ) : (
                      <span className="text-[11.5px] text-text-muted">
                        Só documento estático (sem proposta interativa configurada)
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {servicos.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-text-muted">
                  Nenhuma proposta enviada ainda — o link nasce na aba Itens ou Proposta Interativa
                  de um serviço.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {openId && (
        <CentralDoServico
          servicoId={openId}
          role={role}
          itensOrcamento={itensOrcamento}
          colunasOS={colunas.filter((c) => c.board === "os").sort((a, b) => a.ordem - b.ordem)}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

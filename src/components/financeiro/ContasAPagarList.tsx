import Link from "next/link";
import { fmtBRL } from "@/lib/domain/types";
import type { ContaAPagarItem } from "@/lib/domain/dashboardMetrics";

const TIPO_LABEL: Record<ContaAPagarItem["tipo"], string> = {
  fixa: "Despesa Fixa",
  variavel: "Despesa Variável",
  previsto: "Lançamento Previsto",
};

const TIPO_HREF: Record<ContaAPagarItem["tipo"], string> = {
  fixa: "/financeiro/despesas",
  variavel: "/financeiro/despesas",
  previsto: "/financeiro/lancamentos",
};

function fmtDataCurta(iso: string): string {
  return iso.split("-").reverse().slice(0, 2).join("/");
}

export default function ContasAPagarList({ itens }: { itens: ContaAPagarItem[] }) {
  return (
    <div className="rounded-card border border-border-neutral bg-card p-4">
      <h3 className="mb-3 font-display text-sm font-bold">Contas a Pagar</h3>
      {itens.length === 0 ? (
        <p className="py-4 text-center text-sm text-text-muted">Nada em aberto no momento.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {itens.map((item) => (
            <Link
              key={`${item.tipo}-${item.id}`}
              href={TIPO_HREF[item.tipo]}
              className="flex items-center justify-between rounded-btn px-2 py-2 text-[12.5px] hover:bg-card-secondary"
            >
              <div>
                <p className="font-medium text-text">{item.descricao}</p>
                <p className="text-[11px] text-text-muted">
                  {TIPO_LABEL[item.tipo]}
                  {item.tipo !== "variavel" && ` · vence ${fmtDataCurta(item.vencimento)}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {item.atrasado && (
                  <span className="rounded-pill px-2 py-0.5 text-[10.5px] font-semibold" style={{ color: "#E07A7A" }}>
                    Atrasado
                  </span>
                )}
                {item.venceHoje && (
                  <span className="rounded-pill px-2 py-0.5 text-[10.5px] font-semibold" style={{ color: "#E0A64E" }}>
                    Vence hoje
                  </span>
                )}
                <span className="w-24 text-right font-semibold text-text">{fmtBRL(item.valor)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

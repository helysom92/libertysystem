import Link from "next/link";
import type { ReceitaAtrasadaItem } from "@/lib/domain/dashboardMetrics";
import { fmtBRL } from "@/lib/domain/types";

/** Lançamentos de receita previstos com data já vencida, ainda não marcados como
 * realizados — espelha `DespesasAtrasadasList`, pro lado de "cliente ainda não pagou". */
export default function ReceitasAtrasadasList({ itens }: { itens: ReceitaAtrasadaItem[] }) {
  if (itens.length === 0) return null;

  return (
    <div className="rounded-card border border-danger-border bg-card p-4">
      <h3 className="mb-1 font-display text-sm font-bold text-danger">Receitas Previstas Atrasadas</h3>
      <p className="mb-3 text-[12px] text-text-secondary">
        Data já passou e o cliente ainda não pagou — confirme em Lançamentos assim que entrar.
      </p>
      <div className="flex flex-col gap-1.5">
        {itens.map((item) => (
          <Link
            key={item.id}
            href="/financeiro/lancamentos"
            className="flex items-center justify-between rounded-btn bg-card-secondary px-3 py-2 text-[12.5px] hover:bg-card"
          >
            <div>
              <p className="font-medium">{item.descricao}</p>
              <p className="text-[11px] text-text-muted">{item.data.split("-").reverse().join("/")}</p>
            </div>
            <span className="font-semibold text-danger">{fmtBRL(item.valor)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

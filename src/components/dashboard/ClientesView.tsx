import { fmtBRL, type Cliente, type ClienteStatus } from "@/lib/domain/types";
import { computeClienteStats } from "@/lib/domain/clientes";
import { fmtDatePtBR } from "@/lib/domain/dates";
import type { Servico } from "@/lib/domain/types";
import Pill from "./Pill";

const STATUS_LABELS: Record<ClienteStatus, string> = {
  pre_cadastro: "Pré-Cadastro",
  regularizado: "Regularizado",
  inativo: "Inativo",
};
const STATUS_COLORS: Record<ClienteStatus, string> = {
  pre_cadastro: "#E0A64E",
  regularizado: "#25D366",
  inativo: "#B5AFA0",
};

export default function ClientesView({ clientes, servicos }: { clientes: Cliente[]; servicos: Servico[] }) {
  const rows = clientes
    .map((c) => ({ cliente: c, stats: computeClienteStats(c.id, servicos) }))
    .sort((a, b) => b.stats.totalComprado - a.stats.totalComprado);

  return (
    <div className="rounded-card border border-border-neutral bg-card p-5">
      <p className="mb-4 font-display text-[15px] font-bold text-text">Clientes</p>
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="text-[11px] tracking-wide text-text-muted uppercase">
            <th className="px-1.5 py-2 font-semibold">Cliente</th>
            <th className="px-1.5 py-2 font-semibold">Status</th>
            <th className="px-1.5 py-2 text-right font-semibold">Total comprado</th>
            <th className="px-1.5 py-2 text-right font-semibold">Última compra</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ cliente, stats }) => (
            <tr key={cliente.id} className="border-t border-border-neutral">
              <td className="px-1.5 py-2.5 font-semibold text-text">{cliente.nome}</td>
              <td className="px-1.5 py-2.5">
                <Pill label={STATUS_LABELS[cliente.status]} color={STATUS_COLORS[cliente.status]} />
              </td>
              <td className="px-1.5 py-2.5 text-right font-semibold text-text">{fmtBRL(stats.totalComprado)}</td>
              <td className="px-1.5 py-2.5 text-right text-text-secondary">
                {stats.ultimaCompra ? fmtDatePtBR(stats.ultimaCompra.slice(0, 10)) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

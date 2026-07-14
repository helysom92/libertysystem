import type { Servico } from "./types";

export interface ClienteStats {
  servicosVinculados: number;
  totalComprado: number;
  ultimaCompra: string | null;
}

/** Derived (not stored) client stats, computed from their serviços — matches the prototype's "Cliente" spec. */
export function computeClienteStats(clienteId: string, servicos: Servico[]): ClienteStats {
  const doCliente = servicos.filter((s) => s.cliente_id === clienteId);
  const totalComprado = doCliente.reduce((acc, s) => acc + s.valor_pago, 0);
  const ultimaCompra = doCliente.reduce<string | null>((latest, s) => {
    if (!latest || s.criado_em > latest) return s.criado_em;
    return latest;
  }, null);

  return {
    servicosVinculados: doCliente.length,
    totalComprado,
    ultimaCompra,
  };
}

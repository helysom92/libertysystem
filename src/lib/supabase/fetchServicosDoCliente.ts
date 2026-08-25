import { createClient } from "./client";

export interface ServicoDoCliente {
  id: string;
  numero: string | null;
  descricao: string;
  valor: number;
  valor_pago: number;
  financeiro_status: string;
  criado_em: string;
}

export async function fetchServicosDoCliente(clienteId: string): Promise<ServicoDoCliente[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("servicos")
    .select("id, numero, descricao, valor, valor_pago, financeiro_status, criado_em")
    .eq("cliente_id", clienteId)
    .order("criado_em", { ascending: false });
  return (data as ServicoDoCliente[]) ?? [];
}

import { createClient } from "@/lib/supabase/server";
import { fetchAllClientes } from "@/lib/supabase/fetchAllClientes";
import type { Servico } from "@/lib/domain/types";
import ClientesPageClient from "@/components/clientes/ClientesPageClient";

export default async function ClientesPage() {
  const supabase = await createClient();

  const [clientes, { data: servicos }] = await Promise.all([
    fetchAllClientes(supabase),
    supabase.from("servicos").select("id, cliente_id, valor_pago, criado_em"),
  ]);

  return (
    <ClientesPageClient clientes={clientes} servicos={(servicos as Servico[]) ?? []} />
  );
}

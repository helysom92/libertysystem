import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { allowedTabs, homeTabFor } from "@/lib/domain/flows";
import type { Cliente, Servico } from "@/lib/domain/types";
import ClientesPageClient from "@/components/clientes/ClientesPageClient";

export default async function ClientesPage() {
  const profile = await getCurrentProfile();
  const role = profile?.role ?? "secretaria";
  if (!allowedTabs(role).includes("clientes")) {
    redirect(`/${homeTabFor(role)}`);
  }

  const supabase = await createClient();

  const [{ data: clientes }, { data: servicos }] = await Promise.all([
    supabase.from("clientes").select("*").order("nome"),
    supabase.from("servicos").select("id, cliente_id, valor_pago, criado_em"),
  ]);

  return (
    <ClientesPageClient
      clientes={(clientes as Cliente[]) ?? []}
      servicos={(servicos as Servico[]) ?? []}
    />
  );
}

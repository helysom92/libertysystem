import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/domain/dates";
import AgendaClient from "@/components/agenda/AgendaClient";
import type { Evento } from "@/lib/domain/types";

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string }>;
}) {
  const { data: dataParam } = await searchParams;
  const data = dataParam || todayISO();

  const supabase = await createClient();
  const { data: eventos } = await supabase
    .from("eventos")
    .select("*")
    .eq("data", data)
    .order("hora");

  return <AgendaClient data={data} eventos={(eventos as Evento[]) ?? []} />;
}

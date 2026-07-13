import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import KanbanBoard from "@/components/kanban/KanbanBoard";
import type { Servico } from "@/lib/domain/types";

export default async function ServicosPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string }>;
}) {
  const { open } = await searchParams;
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const { data: servicos } = await supabase
    .from("servicos")
    .select("*")
    .order("criado_em", { ascending: false });

  return (
    <KanbanBoard
      servicos={(servicos as Servico[]) ?? []}
      role={profile?.role ?? "secretaria"}
      initialOpenId={open ?? null}
    />
  );
}

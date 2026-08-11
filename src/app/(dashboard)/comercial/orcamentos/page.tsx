import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import KanbanBoard from "@/components/kanban/KanbanBoard";
import type { Cliente, ItemOrcamento, Servico } from "@/lib/domain/types";
import type { Coluna } from "@/lib/domain/kanban";

export default async function ComercialOrcamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string }>;
}) {
  const { open } = await searchParams;
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const [{ data: servicos }, { data: itensOrcamento }, { data: clientes }, { data: colunas }] =
    await Promise.all([
      supabase.from("servicos").select("*").order("criado_em", { ascending: false }),
      supabase.from("itens_orcamento").select("*").eq("ativo", true).order("nome"),
      supabase.from("clientes").select("*").order("nome"),
      supabase.from("colunas").select("*").order("ordem"),
    ]);

  const svs = (servicos as Servico[]) ?? [];

  // Card cover images: resolve capa_foto_id -> storage_path -> signed URL, batched.
  const capaUrls: Record<string, string> = {};
  const comCapa = svs.filter((s) => s.capa_foto_id);
  if (comCapa.length > 0) {
    const { data: fotos } = await supabase
      .from("fotos")
      .select("id, storage_path")
      .in(
        "id",
        comCapa.map((s) => s.capa_foto_id as string)
      );
    const pathById = new Map((fotos ?? []).map((f) => [f.id, f.storage_path as string]));
    const paths = [...pathById.values()].filter(Boolean);
    if (paths.length > 0) {
      const { data: signed } = await supabase.storage.from("fotos").createSignedUrls(paths, 60 * 60);
      const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
      for (const s of comCapa) {
        const path = pathById.get(s.capa_foto_id as string);
        const url = path ? urlByPath.get(path) : null;
        if (url) capaUrls[s.id] = url;
      }
    }
  }

  // Checklist progress badge.
  const checklistProgress: Record<string, { done: number; total: number }> = {};
  const { data: checklistRows } = await supabase.from("checklist_items").select("servico_id, done");
  for (const row of checklistRows ?? []) {
    const entry = checklistProgress[row.servico_id] ?? { done: 0, total: 0 };
    entry.total += 1;
    if (row.done) entry.done += 1;
    checklistProgress[row.servico_id] = entry;
  }

  return (
    <KanbanBoard
      board="orcamento"
      servicos={svs}
      colunas={(colunas as Coluna[]) ?? []}
      role={profile?.role ?? "secretaria"}
      initialOpenId={open ?? null}
      capaUrls={capaUrls}
      checklistProgress={checklistProgress}
      itensOrcamento={(itensOrcamento as ItemOrcamento[]) ?? []}
      clientes={(clientes as Cliente[]) ?? []}
    />
  );
}

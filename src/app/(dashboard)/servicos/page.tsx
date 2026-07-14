import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import KanbanBoard from "@/components/kanban/KanbanBoard";
import type { Material, Servico } from "@/lib/domain/types";

export default async function ServicosPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string }>;
}) {
  const { open } = await searchParams;
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const [{ data: servicos }, { data: materiais }] = await Promise.all([
    supabase.from("servicos").select("*").order("criado_em", { ascending: false }),
    supabase.from("materiais").select("*").eq("ativo", true).order("nome"),
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

  // Checklist progress badge: generic checklist items + Double Check items combined.
  const checklistProgress: Record<string, { done: number; total: number }> = {};
  const { data: checklistRows } = await supabase.from("checklist_items").select("servico_id, done");
  const checklistByServico = new Map<string, { done: number; total: number }>();
  for (const row of checklistRows ?? []) {
    const entry = checklistByServico.get(row.servico_id) ?? { done: 0, total: 0 };
    entry.total += 1;
    if (row.done) entry.done += 1;
    checklistByServico.set(row.servico_id, entry);
  }
  for (const s of svs) {
    const base = checklistByServico.get(s.id) ?? { done: 0, total: 0 };
    const dcTotal = s.dc_admin.length + s.dc_producao.length;
    const dcDone = s.dc_admin.filter((i) => i.done).length + s.dc_producao.filter((i) => i.done).length;
    checklistProgress[s.id] = { done: base.done + dcDone, total: base.total + dcTotal };
  }

  return (
    <KanbanBoard
      servicos={svs}
      role={profile?.role ?? "secretaria"}
      initialOpenId={open ?? null}
      capaUrls={capaUrls}
      checklistProgress={checklistProgress}
      materiais={(materiais as Material[]) ?? []}
    />
  );
}

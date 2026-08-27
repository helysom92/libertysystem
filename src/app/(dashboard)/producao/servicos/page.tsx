import { createClient } from "@/lib/supabase/server";
import { fetchAllClientes } from "@/lib/supabase/fetchAllClientes";
import { requireTab } from "@/lib/domain/permissions";
import KanbanBoard from "@/components/kanban/KanbanBoard";
import type { ItemOrcamento, Servico } from "@/lib/domain/types";
import type { Coluna } from "@/lib/domain/kanban";
import { CAMPOS_SERVICO_PRODUCAO, toServicoProducaoSafe } from "@/lib/domain/servicoProducao";

const CAMPOS_SERVICO_KANBAN =
  "id, numero, cliente, descricao, valor, financeiro_status, prazo, prazo_tipo, coluna_id, capa_foto_id";

export default async function ServicosPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string }>;
}) {
  const { open } = await searchParams;
  const profile = await requireTab("producao");
  const supabase = await createClient();

  // Só os campos que o card/coluna do Kanban de fato renderizam — o modal (CentralDoServico)
  // busca o registro completo por conta própria quando um card é aberto. Pra Produção, nem
  // esses campos financeiros são buscados (ver CAMPOS_SERVICO_PRODUCAO). Duas queries
  // separadas (em vez de uma só com o nome da coluna condicional) porque o cliente do
  // Supabase tenta tipar o retorno a partir da string do `.select()` em tempo de compilação —
  // uma string condicional confunde esse parser de tipos.
  const servicosQuery =
    profile.role === "producao"
      ? supabase.from("servicos").select(CAMPOS_SERVICO_PRODUCAO).order("criado_em", { ascending: false })
      : supabase.from("servicos").select(CAMPOS_SERVICO_KANBAN).order("criado_em", { ascending: false });

  const [{ data: servicos }, { data: itensOrcamento }, clientes, { data: colunas }, { data: checklistRows }] =
    await Promise.all([
      servicosQuery,
      supabase.from("itens_orcamento").select("*").eq("ativo", true).order("nome"),
      fetchAllClientes(supabase),
      supabase.from("colunas").select("*").order("ordem"),
      supabase.from("checklist_items").select("servico_id, done"),
    ]);

  const svs =
    profile.role === "producao"
      ? ((servicos ?? []) as unknown as Parameters<typeof toServicoProducaoSafe>[0][]).map(toServicoProducaoSafe)
      : ((servicos as unknown as Servico[]) ?? []);

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
  for (const row of checklistRows ?? []) {
    const entry = checklistProgress[row.servico_id] ?? { done: 0, total: 0 };
    entry.total += 1;
    if (row.done) entry.done += 1;
    checklistProgress[row.servico_id] = entry;
  }

  return (
    <KanbanBoard
      board="os"
      role={profile.role}
      servicos={svs}
      colunas={(colunas as Coluna[]) ?? []}
      initialOpenId={open ?? null}
      capaUrls={capaUrls}
      checklistProgress={checklistProgress}
      itensOrcamento={(itensOrcamento as ItemOrcamento[]) ?? []}
      clientes={clientes}
    />
  );
}

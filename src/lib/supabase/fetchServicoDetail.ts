import { createClient } from "./client";
import type { ServicoDetail } from "@/lib/domain/types";

export async function fetchServicoDetail(servicoId: string): Promise<ServicoDetail | null> {
  const supabase = createClient();

  const { data: servico, error } = await supabase
    .from("servicos")
    .select("*")
    .eq("id", servicoId)
    .single();
  if (error || !servico) return null;

  const [
    { data: cliente },
    { data: medidas },
    { data: arquivos },
    { data: fotos },
    { data: checklist },
    { data: timeline },
    { data: historico },
    { data: orcamentoItens },
    { data: propostaOpcoes },
  ] = await Promise.all([
    supabase.from("clientes").select("*").eq("id", servico.cliente_id).single(),
    supabase.from("medicoes").select("*").eq("servico_id", servicoId).order("data", { ascending: false }),
    supabase.from("arquivos").select("*").eq("servico_id", servicoId).order("criado_em", { ascending: false }),
    supabase.from("fotos").select("*").eq("servico_id", servicoId),
    supabase.from("checklist_items").select("*").eq("servico_id", servicoId).order("ordem"),
    supabase.from("timeline_entries").select("*").eq("servico_id", servicoId).order("criado_em", { ascending: false }),
    supabase.from("historico_entries").select("*").eq("servico_id", servicoId).order("criado_em", { ascending: false }),
    supabase.from("orcamento_itens").select("*").eq("servico_id", servicoId).order("ordem"),
    supabase.from("proposta_opcoes").select("*").eq("servico_id", servicoId).order("ordem"),
  ]);

  return {
    servico,
    cliente: cliente!,
    medidas: medidas ?? [],
    arquivos: arquivos ?? [],
    fotos: fotos ?? [],
    checklist: checklist ?? [],
    timeline: timeline ?? [],
    historico: historico ?? [],
    orcamentoItens: orcamentoItens ?? [],
    propostaOpcoes: propostaOpcoes ?? [],
  };
}

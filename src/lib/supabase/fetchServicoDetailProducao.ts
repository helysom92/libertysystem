import { createClient } from "./client";
import type { Cliente, OrcamentoItemRow, Servico, ServicoDetail } from "@/lib/domain/types";

interface ServicoProducaoRpcResult {
  servico: Pick<
    Servico,
    | "id"
    | "numero"
    | "descricao"
    | "tipo"
    | "estagio"
    | "coluna_id"
    | "concluido"
    | "prazo"
    | "prazo_tipo"
    | "prazo_inicio"
    | "informacoes_adicionais"
    | "local_instalacao"
    | "responsavel"
    | "prioridade"
    | "capa_foto_id"
    | "proxima_acao_texto"
    | "proxima_responsavel"
    | "proxima_prazo"
    | "motivo_espera"
    | "entrega_confirmada"
    | "criado_em"
  > & { cliente_id: string };
  cliente: { nome: string; whatsapp: string | null };
  itens: Pick<
    OrcamentoItemRow,
    "id" | "descricao" | "categoria_prazo" | "largura_cm" | "altura_cm" | "quantidade" | "ordem" | "mostrar_medida_cliente"
  >[];
}

/**
 * Equivalente a `fetchServicoDetail`, mas só pro papel Produção — usa a função `security
 * definer` `get_servico_producao` (nunca busca valor/valor_pago/financeiro_status/parcelas/
 * proposta) e completa o resto com placeholder neutro, pra bater com o tipo `ServicoDetail`
 * sem precisar mudar as abas que já existem.
 */
export async function fetchServicoDetailProducao(servicoId: string): Promise<ServicoDetail | null> {
  const supabase = createClient();

  const { data: rpcData, error } = await supabase.rpc("get_servico_producao", { p_servico_id: servicoId });
  if (error || !rpcData) return null;
  const result = rpcData as ServicoProducaoRpcResult;

  const [
    { data: medidas },
    { data: arquivos },
    { data: fotos },
    { data: checklist },
    { data: timeline },
    { data: historico },
    { data: eventos },
  ] = await Promise.all([
    supabase.from("medicoes").select("*").eq("servico_id", servicoId).order("data", { ascending: false }),
    supabase.from("arquivos").select("*").eq("servico_id", servicoId).order("criado_em", { ascending: false }),
    supabase.from("fotos").select("*").eq("servico_id", servicoId),
    supabase.from("checklist_items").select("*").eq("servico_id", servicoId).order("ordem"),
    supabase.from("timeline_entries").select("*").eq("servico_id", servicoId).order("criado_em", { ascending: false }),
    supabase.from("historico_entries").select("*").eq("servico_id", servicoId).order("criado_em", { ascending: false }),
    supabase.from("eventos").select("*").eq("servico_id", servicoId).order("data"),
  ]);

  const servico: Servico = {
    ...result.servico,
    cliente: result.cliente.nome,
    aprovado_em: null,
    valor: 0,
    valor_pago: 0,
    financeiro_status: "Não orçado",
    liberado_admin: false,
    linha_orcamento: null,
    validade_proposta_dias: 0,
    forma_pagamento_texto: null,
    durabilidade_texto: null,
    share_token: null,
    proposta_opcao_escolhida: null,
    proposta_escolhida_em: null,
    concluido_em: null,
  };

  const cliente: Cliente = {
    id: result.servico.cliente_id,
    nome: result.cliente.nome,
    whatsapp: result.cliente.whatsapp,
    empresa: null,
    cpf_cnpj: null,
    cidade: null,
    endereco: null,
    whatsapp_2: null,
    email: null,
    observacoes: null,
    status: "regularizado",
    created_at: "",
  };

  const orcamentoItens: OrcamentoItemRow[] = result.itens.map((item) => ({
    ...item,
    servico_id: servicoId,
    modo_calculo: "catalogo",
    item_orcamento_id: null,
    custo_direto: null,
    preco_m2_manual: null,
    valor_final: 0,
  }));

  return {
    servico,
    cliente,
    medidas: medidas ?? [],
    arquivos: arquivos ?? [],
    fotos: fotos ?? [],
    checklist: checklist ?? [],
    timeline: timeline ?? [],
    historico: historico ?? [],
    orcamentoItens,
    propostaOpcoes: [],
    eventos: eventos ?? [],
    parcelas: [],
  };
}

import { createClient } from "@/lib/supabase/server";
import { calcularItemOrcamento, unitParaExibicao, type OrcamentoItemDraft } from "@/lib/domain/orcamento";
import { formatItemDetalhe } from "@/lib/domain/orcamentoText";
import type { ItemOrcamento, OrcamentoItemRow } from "@/lib/domain/types";
import OrcamentoDocumento, { type OrcamentoDocumentoItem } from "@/components/servico-modal/OrcamentoDocumento";
import PrintTrigger from "./PrintTrigger";

function toDraft(row: OrcamentoItemRow): OrcamentoItemDraft {
  return {
    categoriaPrazo: row.categoria_prazo,
    modoCalculo: row.modo_calculo,
    itemOrcamentoId: row.item_orcamento_id,
    larguraCm: row.largura_cm ?? 0,
    alturaCm: row.altura_cm ?? 0,
    quantidade: row.quantidade,
    custoDireto: row.custo_direto ?? 0,
    precoM2Manual: row.preco_m2_manual ?? 0,
  };
}

export default async function ImprimirServicoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: servico } = await supabase.from("servicos").select("*").eq("id", id).single();
  if (!servico) return <p style={{ padding: 32 }}>Serviço não encontrado.</p>;

  const [{ data: cliente }, { data: orcamentoItens }, { data: catalogo }] = await Promise.all([
    supabase.from("clientes").select("*").eq("id", servico.cliente_id).single(),
    supabase.from("orcamento_itens").select("*").eq("servico_id", id).order("ordem"),
    supabase.from("itens_orcamento").select("*"),
  ]);

  const rows = (orcamentoItens as OrcamentoItemRow[]) ?? [];
  const catalogItens = (catalogo as ItemOrcamento[]) ?? [];

  const itens: OrcamentoDocumentoItem[] = rows.map((row) => {
    const calc = calcularItemOrcamento(toDraft(row), catalogItens);
    const unit = unitParaExibicao(row.modo_calculo, calc, row.valor_final, row.quantidade);
    const itemCatalogo = catalogItens.find((i) => i.id === row.item_orcamento_id);
    return {
      descricao: row.descricao,
      categoriaPrazo: row.categoria_prazo,
      detalhe: formatItemDetalhe(row.modo_calculo, { ...calc, unit }, {
        itemNome: itemCatalogo?.nome,
        larguraCm: row.largura_cm,
        alturaCm: row.altura_cm,
        quantidade: row.quantidade,
      }),
      valorUnit: unit,
      valorFinal: row.valor_final,
    };
  });

  return (
    <div style={{ background: "#fff", minHeight: "100vh", paddingTop: 24 }}>
      <style>{`@page { margin: 0.4in; }`}</style>
      <OrcamentoDocumento
        numero={servico.numero}
        descricaoServico={servico.descricao}
        valorServico={servico.valor}
        clienteNome={cliente?.nome ?? servico.cliente}
        linha={servico.linha_orcamento}
        validadeDias={servico.validade_proposta_dias}
        formaPagamentoTexto={servico.forma_pagamento_texto}
        durabilidadeTexto={servico.durabilidade_texto}
        itens={itens}
      />
      <PrintTrigger />
    </div>
  );
}

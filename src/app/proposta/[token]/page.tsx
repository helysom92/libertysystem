import { createClient } from "@/lib/supabase/server";
import { calcularItemOrcamento, type LinhaOrcamento, type OrcamentoItemDraft } from "@/lib/domain/orcamento";
import { formatItemDetalhe } from "@/lib/domain/orcamentoText";
import type { ItemOrcamento, OrcamentoItemRow } from "@/lib/domain/types";
import OrcamentoDocumento, { type OrcamentoDocumentoItem } from "@/components/servico-modal/OrcamentoDocumento";
import ImprimirButton from "./ImprimirButton";

interface PropostaPublica {
  servico: {
    numero: string | null;
    descricao: string;
    valor: number;
    linha_orcamento: LinhaOrcamento;
    validade_proposta_dias: number;
    forma_pagamento_texto: string | null;
    durabilidade_texto: string | null;
  };
  cliente: { nome: string };
  itens: OrcamentoItemRow[];
  catalogo: ItemOrcamento[];
  foto_storage_path: string | null;
}

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

export default async function PropostaPublicaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  const { data } = await supabase.rpc("get_proposta_publica", { p_token: token });
  const proposta = data as PropostaPublica | null;

  if (!proposta) {
    return (
      <div style={{ minHeight: "100vh", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontFamily: "'Manrope', system-ui, sans-serif", color: "#6b6357", fontSize: 14 }}>
          Essa proposta não foi encontrada ou o link expirou.
        </p>
      </div>
    );
  }

  const itens: OrcamentoDocumentoItem[] = proposta.itens.map((row) => {
    const calc = calcularItemOrcamento(toDraft(row), proposta.catalogo);
    const itemCatalogo = proposta.catalogo.find((i) => i.id === row.item_orcamento_id);
    return {
      descricao: row.descricao,
      categoriaPrazo: row.categoria_prazo,
      detalhe: formatItemDetalhe(row.modo_calculo, calc, {
        itemNome: itemCatalogo?.nome,
        larguraCm: row.largura_cm,
        alturaCm: row.altura_cm,
        quantidade: row.quantidade,
      }),
      valorUnit: calc.unit,
      valorFinal: row.valor_final,
    };
  });

  let fotoUrl: string | null = null;
  if (proposta.foto_storage_path) {
    const { data: signed } = await supabase.storage.from("fotos").createSignedUrl(proposta.foto_storage_path, 60 * 60);
    fotoUrl = signed?.signedUrl ?? null;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#fff", paddingTop: 24 }}>
      <style>{`@page { margin: 0.4in; }`}</style>
      <ImprimirButton />
      <OrcamentoDocumento
        numero={proposta.servico.numero}
        descricaoServico={proposta.servico.descricao}
        valorServico={proposta.servico.valor}
        clienteNome={proposta.cliente.nome}
        linha={proposta.servico.linha_orcamento}
        validadeDias={proposta.servico.validade_proposta_dias}
        formaPagamentoTexto={proposta.servico.forma_pagamento_texto}
        durabilidadeTexto={proposta.servico.durabilidade_texto}
        itens={itens}
        fotoUrl={fotoUrl}
      />
    </div>
  );
}

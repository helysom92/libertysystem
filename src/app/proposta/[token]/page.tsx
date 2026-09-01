import { createClient } from "@/lib/supabase/server";
import type { LinhaOrcamento } from "@/lib/domain/orcamento";
import { formatItemDetalhe } from "@/lib/domain/orcamentoText";
import type { CategoriaPrazo, ModoCalculoItem } from "@/lib/domain/orcamento";
import OrcamentoDocumento, { type OrcamentoDocumentoItem } from "@/components/servico-modal/OrcamentoDocumento";
import ImprimirButton from "./ImprimirButton";

// DTO já pré-computado do lado seguro (dentro da RPC `get_proposta_publica`) — nunca inclui
// custo_direto, preco_m2_manual, nem o catálogo interno completo. Só o resultado final do
// cálculo de preço (area/valor_unit), pronto pra exibir.
interface ItemPropostaPublica {
  descricao: string;
  categoria_prazo: CategoriaPrazo;
  modo_calculo: ModoCalculoItem;
  largura_cm: number | null;
  altura_cm: number | null;
  quantidade: number;
  mostrar_medida_cliente: boolean;
  item_nome: string | null;
  area: number | null;
  valor_unit: number;
  valor_final: number;
}

interface PropostaPublica {
  servico: {
    numero: string | null;
    descricao: string;
    valor: number;
    linha_orcamento: LinhaOrcamento | null;
    validade_proposta_dias: number;
    forma_pagamento_texto: string | null;
    durabilidade_texto: string | null;
  };
  cliente: { nome: string };
  itens: ItemPropostaPublica[];
  foto_storage_path: string | null;
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

  const itens: OrcamentoDocumentoItem[] = proposta.itens.map((row) => ({
    descricao: row.descricao,
    categoriaPrazo: row.categoria_prazo,
    detalhe: formatItemDetalhe(
      row.modo_calculo,
      { area: row.area, unit: row.valor_unit, sugerido: row.valor_final, minimoAplicado: false },
      {
        itemNome: row.item_nome,
        larguraCm: row.largura_cm,
        alturaCm: row.altura_cm,
        quantidade: row.quantidade,
        mostrarMedidaCliente: row.mostrar_medida_cliente,
      }
    ),
    valorUnit: row.valor_unit,
    valorFinal: row.valor_final,
  }));

  return (
    <div style={{ minHeight: "100vh", background: "#fff", paddingTop: 24 }}>
      <style>{`
        @page { margin: 0.4in; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
      `}</style>
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
      />
    </div>
  );
}

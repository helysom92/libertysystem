import { createClient } from "@/lib/supabase/server";
import { displayNumero } from "@/lib/domain/types";
import ReciboDocumento from "@/components/servico-modal/ReciboDocumento";
import PrintTrigger from "../../../imprimir/PrintTrigger";

export default async function ReciboParcelaPage({
  params,
}: {
  params: Promise<{ id: string; parcelaId: string }>;
}) {
  const { id, parcelaId } = await params;
  const supabase = await createClient();

  const [{ data: servico }, { data: parcela }] = await Promise.all([
    supabase.from("servicos").select("*").eq("id", id).single(),
    supabase.from("servico_parcelas").select("*").eq("id", parcelaId).eq("servico_id", id).single(),
  ]);

  if (!servico || !parcela || parcela.valor_pago == null) {
    return <p style={{ padding: 32 }}>Recibo não encontrado ou pagamento ainda não confirmado.</p>;
  }

  const { data: cliente } = await supabase.from("clientes").select("nome").eq("id", servico.cliente_id).single();

  return (
    <div style={{ background: "#fff", minHeight: "100vh", paddingTop: 24 }}>
      <style>{`
        @page { margin: 0.4in; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
      `}</style>
      <ReciboDocumento
        numero={displayNumero(servico)}
        clienteNome={cliente?.nome ?? servico.cliente}
        descricaoServico={`${displayNumero(servico)} — ${servico.descricao}`}
        descricaoParcela={parcela.descricao}
        valorPago={parcela.valor_pago}
        dataPagamento={parcela.pago_em ? parcela.pago_em.slice(0, 10) : new Date().toISOString().slice(0, 10)}
        formaPagamento={parcela.forma_pagamento}
      />
      <PrintTrigger />
    </div>
  );
}

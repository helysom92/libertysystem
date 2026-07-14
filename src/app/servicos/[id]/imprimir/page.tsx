import { createClient } from "@/lib/supabase/server";
import { displayNumero, fmtBRL } from "@/lib/domain/types";
import PrintTrigger from "./PrintTrigger";

export default async function ImprimirServicoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: servico } = await supabase.from("servicos").select("*").eq("id", id).single();
  if (!servico) return <p>Serviço não encontrado.</p>;

  const { data: cliente } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", servico.cliente_id)
    .single();

  const rows: [string, string][] = [
    ["Cliente", servico.cliente],
    ["Telefone", cliente?.whatsapp || "—"],
    ["Valor", fmtBRL(servico.valor)],
    ["Prazo", servico.prazo || "—"],
    ["Financeiro", servico.financeiro_status],
    ["Etapa", servico.estagio],
  ];

  return (
    <div style={{ fontFamily: "sans-serif", padding: 32, color: "#111" }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>LIBERTY VISUAL E MARKETING</h1>
      <p style={{ marginBottom: 20, color: "#555" }}>
        {displayNumero(servico)} — {servico.descricao}
      </p>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <td style={{ padding: "6px 12px", fontWeight: 600, border: "1px solid #ccc" }}>
                {label}
              </td>
              <td style={{ padding: "6px 12px", border: "1px solid #ccc" }}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <PrintTrigger />
    </div>
  );
}

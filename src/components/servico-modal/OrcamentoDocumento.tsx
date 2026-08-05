import {
  LINHA_ORCAMENTO_INFO,
  prazoEstimadoLabel,
  type CategoriaPrazo,
  type LinhaOrcamento,
} from "@/lib/domain/orcamento";
import { fmtBRL } from "@/lib/domain/types";
import { LIBERTY_CIDADE, LIBERTY_CNPJ, LIBERTY_ENDERECO, LIBERTY_TELEFONE } from "@/lib/domain/orcamentoText";

export interface OrcamentoDocumentoItem {
  descricao: string;
  categoriaPrazo: CategoriaPrazo;
  detalhe: string;
  valorUnit: number;
  valorFinal: number;
}

export interface OrcamentoDocumentoProps {
  numero: string | null;
  descricaoServico: string;
  valorServico: number;
  clienteNome: string;
  linha: LinhaOrcamento;
  validadeDias: number;
  formaPagamentoTexto: string | null;
  durabilidadeTexto: string | null;
  itens: OrcamentoDocumentoItem[];
  fotoUrl: string | null;
}

const INK = "#1b1712";
const GOLD_TITLE = "#f4ead0";
const GOLD_SUB = "#c9bfa8";
const CARD_BG = "#fbf8f2";
const TEXT_MUTED = "#6b6357";
const TOTAL_GOLD = "#8a6516";

export default function OrcamentoDocumento({
  numero,
  descricaoServico,
  valorServico,
  clienteNome,
  linha,
  validadeDias,
  formaPagamentoTexto,
  durabilidadeTexto,
  itens,
  fotoUrl,
}: OrcamentoDocumentoProps) {
  const hoje = new Date().toLocaleDateString("pt-BR");
  const tier = LINHA_ORCAMENTO_INFO[linha];
  const isOS = numero != null;

  const linhas = itens.length > 0 ? itens : [
    { descricao: descricaoServico, categoriaPrazo: "balcao" as CategoriaPrazo, detalhe: "", valorUnit: valorServico, valorFinal: valorServico },
  ];
  const total = linhas.reduce((sum, i) => sum + i.valorFinal, 0);
  const prazo = itens.length > 0 ? prazoEstimadoLabel(itens.map((i) => i.categoriaPrazo)) : null;

  return (
    <div style={{ fontFamily: "'Manrope', system-ui, sans-serif", color: INK, maxWidth: 850, margin: "0 auto" }}>
      <div style={{ background: INK, padding: "28px 0.55in 20px", borderBottom: `3px solid ${tier.ring}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/liberty-logo.png" alt="Liberty" style={{ height: 42, width: "auto", objectFit: "contain" }} />
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 1.5, color: GOLD_TITLE }}>
              {isOS ? "ORDEM DE SERVIÇO" : "ORÇAMENTO"}
            </div>
            <div style={{ fontSize: 12.5, color: GOLD_SUB, marginTop: 4 }}>
              Data: {hoje}
              {numero && <> &nbsp;·&nbsp; Nº {numero}</>}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginTop: 18,
            paddingTop: 14,
            borderTop: "1px solid rgba(244,234,208,0.15)",
            fontSize: 12,
            color: GOLD_SUB,
            lineHeight: 1.6,
          }}
        >
          <div>
            <div>📞 {LIBERTY_TELEFONE}</div>
            <div>CNPJ: {LIBERTY_CNPJ}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div>{LIBERTY_ENDERECO}</div>
            <div>{LIBERTY_CIDADE}</div>
          </div>
        </div>
      </div>

      <div style={{ padding: "0 0.55in" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 22 }}>
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: TEXT_MUTED, marginBottom: 3 }}>
              Cliente
            </div>
            <div style={{ fontSize: 19, fontWeight: 700, color: INK }}>{clienteNome}</div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "9px 18px",
              borderRadius: 999,
              background: tier.ring,
              color: INK,
            }}
          >
            <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase" }}>
              {tier.label}
            </span>
          </div>
        </div>
        <div style={{ fontSize: 12.5, color: TEXT_MUTED, marginTop: 4 }}>{tier.sub}</div>

        <div style={{ display: "flex", gap: 22, marginTop: 24, alignItems: "stretch" }}>
          <div
            style={{
              width: 220,
              height: 220,
              flex: "none",
              borderRadius: 10,
              border: "1px solid rgba(27,23,18,0.12)",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#f1ece0",
            }}
          >
            {fotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fotoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ fontSize: 11.5, color: TEXT_MUTED, textAlign: "center", padding: 12 }}>
                Foto de amostra do serviço/acabamento
              </span>
            )}
          </div>
          <div style={{ flex: 1, background: CARD_BG, border: "1px solid rgba(27,23,18,0.1)", borderRadius: 10, padding: "18px 20px" }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: TEXT_MUTED, marginBottom: 8 }}>
              Sobre este orçamento
            </div>
            <div style={{ fontSize: 13.5, color: INK, lineHeight: 1.65 }}>{descricaoServico}</div>
          </div>
        </div>

        <table style={{ borderCollapse: "collapse", width: "100%", marginTop: 26 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${INK}` }}>
              <th style={{ textAlign: "left", padding: "0 0 8px", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, color: TEXT_MUTED, fontWeight: 700 }}>
                Descrição do item
              </th>
              <th style={{ textAlign: "center", padding: "0 0 8px", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, color: TEXT_MUTED, fontWeight: 700, width: 60 }}>
                Qtd.
              </th>
              <th style={{ textAlign: "right", padding: "0 0 8px", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, color: TEXT_MUTED, fontWeight: 700, width: 110 }}>
                Valor unit.
              </th>
              <th style={{ textAlign: "right", padding: "0 0 8px", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, color: TEXT_MUTED, fontWeight: 700, width: 70 }}>
                Desc.
              </th>
              <th style={{ textAlign: "right", padding: "0 0 8px", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, color: TEXT_MUTED, fontWeight: 700, width: 110 }}>
                Valor final
              </th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((item, idx) => (
              <tr key={idx} style={{ borderBottom: "1px solid rgba(27,23,18,0.1)" }}>
                <td style={{ padding: "12px 8px 12px 0", fontSize: 13.5, color: INK, fontWeight: 600 }}>
                  {item.descricao || "(sem descrição)"}
                  {item.detalhe && (
                    <div style={{ fontSize: 12, color: TEXT_MUTED, fontWeight: 400, marginTop: 2 }}>{item.detalhe}</div>
                  )}
                </td>
                <td style={{ padding: "12px 0", fontSize: 13.5, color: INK, textAlign: "center" }}>1</td>
                <td style={{ padding: "12px 0", fontSize: 13.5, color: INK, textAlign: "right" }}>{fmtBRL(item.valorUnit)}</td>
                <td style={{ padding: "12px 0", fontSize: 13.5, color: TEXT_MUTED, textAlign: "right" }}>—</td>
                <td style={{ padding: "12px 0 12px 8px", fontSize: 13.5, color: INK, textAlign: "right", fontWeight: 700 }}>
                  {fmtBRL(item.valorFinal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
          <div style={{ width: 260 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, color: TEXT_MUTED }}>
              <span>Subtotal</span>
              <span>{fmtBRL(total)}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 0 0",
                marginTop: 6,
                borderTop: `2px solid ${INK}`,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 800, color: INK, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Total
              </span>
              <span style={{ fontSize: 22, fontWeight: 800, color: TOTAL_GOLD }}>{fmtBRL(total)}</span>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginTop: 28 }}>
          {prazo && (
            <div style={{ background: CARD_BG, border: "1px solid rgba(27,23,18,0.1)", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.6, color: TEXT_MUTED, marginBottom: 4 }}>
                Prazo de entrega
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>{prazo}</div>
            </div>
          )}
          <div style={{ background: CARD_BG, border: "1px solid rgba(27,23,18,0.1)", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.6, color: TEXT_MUTED, marginBottom: 4 }}>
              Validade da proposta
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>{validadeDias} dias</div>
          </div>
          <div style={{ background: CARD_BG, border: "1px solid rgba(27,23,18,0.1)", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.6, color: TEXT_MUTED, marginBottom: 4 }}>
              Forma de pagamento
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: INK, lineHeight: 1.5 }}>
              {formaPagamentoTexto || "A combinar"}
            </div>
          </div>
          {durabilidadeTexto && (
            <div style={{ background: CARD_BG, border: "1px solid rgba(27,23,18,0.1)", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.6, color: TEXT_MUTED, marginBottom: 4 }}>
                Durabilidade estimada
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>{durabilidadeTexto}</div>
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginTop: 34,
            paddingTop: 18,
            paddingBottom: 28,
            borderTop: "1px solid rgba(27,23,18,0.12)",
          }}
        >
          <div style={{ fontSize: 13, color: INK }}>Agradecemos a preferência! 🙌</div>
          <div style={{ fontSize: 12, color: TEXT_MUTED, textAlign: "right" }}>De acordo: ____/____/________</div>
        </div>
      </div>
    </div>
  );
}

import { fmtBRL } from "@/lib/domain/types";
import { fmtDatePtBR } from "@/lib/domain/dates";
import { LIBERTY_CIDADE, LIBERTY_CNPJ, LIBERTY_ENDERECO, LIBERTY_TELEFONE } from "@/lib/domain/orcamentoText";

export interface ReciboDocumentoProps {
  numero: string | null;
  clienteNome: string;
  descricaoServico: string;
  descricaoParcela: string;
  valorPago: number;
  dataPagamento: string;
  formaPagamento: string | null;
}

const INK = "#1b1712";
const GOLD_TITLE = "#f4ead0";
const GOLD_SUB = "#c9bfa8";
const CARD_BG = "#fbf8f2";
const TEXT_MUTED = "#6b6357";
const TOTAL_GOLD = "#8a6516";
const DEFAULT_RING = "#c9bfa8";

export default function ReciboDocumento({
  numero,
  clienteNome,
  descricaoServico,
  descricaoParcela,
  valorPago,
  dataPagamento,
  formaPagamento,
}: ReciboDocumentoProps) {
  const hoje = new Date().toLocaleDateString("pt-BR");

  return (
    <div style={{ fontFamily: "'Manrope', system-ui, sans-serif", color: INK, maxWidth: 700, margin: "0 auto" }}>
      <div style={{ background: INK, padding: "28px 0.55in 20px", borderBottom: `3px solid ${DEFAULT_RING}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/liberty-logo.png" alt="Liberty" style={{ height: 42, width: "auto", objectFit: "contain" }} />
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 1.5, color: GOLD_TITLE }}>RECIBO</div>
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
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: TEXT_MUTED, marginBottom: 3 }}>
            Recebemos de
          </div>
          <div style={{ fontSize: 19, fontWeight: 700, color: INK }}>{clienteNome}</div>
        </div>

        <div
          style={{
            marginTop: 20,
            background: CARD_BG,
            border: "1px solid rgba(27,23,18,0.1)",
            borderRadius: 10,
            padding: "20px 22px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: TEXT_MUTED, marginBottom: 6 }}>
            Valor recebido
          </div>
          <div style={{ fontSize: 34, fontWeight: 800, color: TOTAL_GOLD }}>{fmtBRL(valorPago)}</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginTop: 20 }}>
          <div style={{ background: CARD_BG, border: "1px solid rgba(27,23,18,0.1)", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.6, color: TEXT_MUTED, marginBottom: 4 }}>
              Referente a
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: INK, lineHeight: 1.5 }}>
              {descricaoServico}
              <div style={{ fontSize: 12, color: TEXT_MUTED, fontWeight: 400, marginTop: 2 }}>{descricaoParcela}</div>
            </div>
          </div>
          <div style={{ background: CARD_BG, border: "1px solid rgba(27,23,18,0.1)", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.6, color: TEXT_MUTED, marginBottom: 4 }}>
              Data do pagamento
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>{fmtDatePtBR(dataPagamento)}</div>
            {formaPagamento && (
              <div style={{ fontSize: 12.5, color: TEXT_MUTED, marginTop: 4 }}>{formaPagamento}</div>
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginTop: 40,
            paddingTop: 18,
            paddingBottom: 28,
            borderTop: "1px solid rgba(27,23,18,0.12)",
          }}
        >
          <div style={{ fontSize: 13, color: INK }}>Agradecemos a preferência! 🙌</div>
          <div style={{ fontSize: 12, color: TEXT_MUTED, textAlign: "right" }}>Assinatura: ______________________</div>
        </div>
      </div>
    </div>
  );
}

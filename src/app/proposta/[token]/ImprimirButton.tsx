"use client";

export default function ImprimirButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print"
      style={{
        display: "block",
        margin: "0 auto 24px",
        padding: "10px 20px",
        borderRadius: 10,
        border: "1px solid #c9a24b",
        background: "transparent",
        color: "#8a6516",
        fontFamily: "'Manrope', system-ui, sans-serif",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      🖨️ Imprimir / Salvar PDF
    </button>
  );
}

const COLORS: Record<string, string> = {
  "Não orçado": "rgba(244,242,236,0.5)",
  Orçado: "#E0A64E",
  "Aguardando sinal": "#E0A64E",
  "Parcialmente pago": "#E0A64E",
  Pago: "#25D366",
  Vencido: "#E07A7A",
  Cancelado: "#E07A7A",
  Cortesia: "#25D366",
};

export default function FinanceiroBadge({ status }: { status: string }) {
  const color = COLORS[status] ?? "rgba(244,242,236,0.5)";
  return (
    <span
      className="rounded-pill px-2.5 py-0.5 text-[10.5px] font-semibold"
      style={{ color, backgroundColor: `${color}22`, border: `1px solid ${color}55` }}
    >
      {status}
    </span>
  );
}

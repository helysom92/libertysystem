const REGRAS = [
  "Pedido mínimo: R$ 80",
  "Lona e adesivo: cobrança mínima de 1 m²",
  "Entrada de 50% e saldo na entrega",
  "Parcelamento em até 10x",
  "Desconto apenas em Pix/dinheiro, para serviços grandes e mediante aprovação",
  "Serviços sob projeto: custo direto × 3 + 15% (sugerido), nunca abaixo de custo × 3",
];

export default function RegrasComerciais() {
  return (
    <div className="mb-6 rounded-card border border-border-gold bg-card-secondary p-4">
      <h2 className="mb-2 font-display text-sm font-bold text-gold">Regras Comerciais</h2>
      <ul className="flex flex-col gap-1 text-[12.5px] text-text-secondary">
        {REGRAS.map((r) => (
          <li key={r}>• {r}</li>
        ))}
      </ul>
    </div>
  );
}

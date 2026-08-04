import { PEDIDO_MINIMO } from "@/lib/domain/orcamento";
import { fmtBRL } from "@/lib/domain/types";

const REGRAS = [
  `Pedido mínimo: ${fmtBRL(PEDIDO_MINIMO)}`,
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

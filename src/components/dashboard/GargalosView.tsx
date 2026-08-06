import { computeGestaoBuckets } from "@/lib/domain/gestaoBuckets";
import type { Comprovante, Servico } from "@/lib/domain/types";
import BucketCard from "@/components/gestao/BucketCard";

export default function GargalosView({
  servicos,
  comprovantes,
}: {
  servicos: Servico[];
  comprovantes: Comprovante[];
}) {
  const buckets = computeGestaoBuckets(servicos, comprovantes);

  return (
    <div>
      <div className="mb-4">
        <p className="text-[13px] text-text-secondary">
          Serviços que precisam de atenção — atrasados, sem responsável, sem próxima ação e afins
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {buckets.map((b) => (
          <BucketCard key={b.titulo} bucket={b} />
        ))}
      </div>
    </div>
  );
}

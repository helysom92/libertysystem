import type { ServicoDetail } from "@/lib/domain/types";
import { pendenciasParaConclusao } from "@/lib/domain/pendenciasConclusao";

export default function PendenciasTab({ detail }: { detail: ServicoDetail }) {
  const pendencias = pendenciasParaConclusao(detail);

  if (detail.servico.concluido) {
    return <p className="text-center text-[12.5px] font-semibold text-success">✓ Serviço concluído</p>;
  }

  if (pendencias.length === 0) {
    return (
      <p className="rounded-card border border-border-neutral bg-card-secondary p-4 text-center text-[13px] text-success">
        Nada pendente — pronto pra concluir 🎉
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="mb-1 text-[12px] text-text-secondary">
        Só o que falta operacionalmente pra concluir esta OS — sem relação com o financeiro (o
        saldo continua sendo cobrado normalmente depois de concluída).
      </p>
      {pendencias.map((p, i) => (
        <div
          key={i}
          className="rounded-card border border-border-gold bg-card-secondary px-3 py-2 text-[13px]"
        >
          {p.texto}
        </div>
      ))}
    </div>
  );
}

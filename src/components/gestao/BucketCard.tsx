import type { Bucket } from "@/lib/domain/gestaoBuckets";

export default function BucketCard({ bucket }: { bucket: Bucket }) {
  // Comprovantes aren't serviços — route that one bucket to Financeiro instead of the
  // servico modal (see plan §4: fixes the prototype's negative-id fake-serviço hack).
  const isComprovanteBucket = bucket.titulo === "Comprovante sem Conferência";

  return (
    <div
      className="flex max-h-64 flex-col overflow-hidden rounded-card border bg-card p-3"
      style={{ borderColor: bucket.borderColor }}
    >
      <p
        className="mb-2 text-[11.5px] font-semibold tracking-wide uppercase"
        style={{ color: bucket.titleColor }}
      >
        {bucket.titulo} · {bucket.count}
      </p>
      <div className="flex flex-col gap-1.5 overflow-y-auto">
        {bucket.items.map((item) => (
          <a
            key={item.id}
            href={isComprovanteBucket ? "/financeiro" : `/servicos?open=${item.id}`}
            className="rounded-btn bg-card-secondary px-2.5 py-1.5 hover:bg-card"
          >
            <p className="text-[13px] font-semibold">{item.cliente}</p>
            <p className="text-[11.5px] text-text-secondary">{item.descricao}</p>
          </a>
        ))}
        {bucket.empty && <p className="text-[12.5px] text-text-muted">Nenhum serviço.</p>}
      </div>
    </div>
  );
}

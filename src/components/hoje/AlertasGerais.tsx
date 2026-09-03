interface AlertaGeral {
  texto: string;
  cor: string;
}

/** Genérico o bastante pra alertas comerciais (Etapa 5) e pessoais (Etapa 8) — sem link por
 * serviço como `AlertasIA`, já que essas listas não vêm amarradas a um `servicoId`/modal. */
export default function AlertasGerais({ titulo, alertas, href }: { titulo: string; alertas: AlertaGeral[]; href?: string }) {
  if (alertas.length === 0) return null;

  return (
    <div className="rounded-card border border-border-neutral bg-card p-4">
      <h3 className="mb-3 font-display text-sm font-bold">
        <span className="mr-1.5 text-gold">●</span>
        {titulo}
      </h3>
      <div className="flex flex-col gap-1">
        {alertas.map((a, i) =>
          href ? (
            <a key={i} href={href} className="rounded-btn px-2 py-1.5 text-[13px] hover:bg-card-secondary" style={{ color: a.cor }}>
              ● {a.texto}
            </a>
          ) : (
            <p key={i} className="rounded-btn px-2 py-1.5 text-[13px]" style={{ color: a.cor }}>
              ● {a.texto}
            </p>
          )
        )}
      </div>
    </div>
  );
}

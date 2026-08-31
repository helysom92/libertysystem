"use client";

import { useRouter } from "next/navigation";

/** Estado de erro compartilhado pras páginas do Financeiro — nunca mostrar uma tela vazia/zero
 * quando a consulta ao banco falha, sempre com opção de tentar de novo. */
export default function ErroConsulta({ mensagem }: { mensagem: string }) {
  const router = useRouter();
  return (
    <div className="rounded-card border border-danger-border bg-card-secondary p-4">
      <p className="text-sm text-danger">Não foi possível carregar esta tela: {mensagem}</p>
      <button
        type="button"
        onClick={() => router.refresh()}
        className="mt-2 rounded-btn border border-border-gold-strong px-3 py-1.5 text-[12.5px] text-gold"
      >
        Tentar novamente
      </button>
    </div>
  );
}

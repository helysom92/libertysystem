"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { hojeISOOperacao } from "@/lib/domain/dates";

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/** Seletor de mês único pro módulo inteiro — vive na URL (`?ano=&mes=`), então persiste ao
 * trocar de aba (os links de `FinanceiroTabs` já repassam a query atual) e ao recarregar a
 * página. Renderizado uma vez, ao lado das abas. */
export default function SeletorMesFinanceiro() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const hoje = hojeISOOperacao();
  const [anoAtual, mesAtual] = hoje.split("-").map(Number);
  const ano = Number(searchParams.get("ano")) || anoAtual;
  const mes = Number(searchParams.get("mes")) || mesAtual;
  const ehMesAtual = ano === anoAtual && mes === mesAtual;

  function irPara(novoAno: number, novoMes: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("ano", String(novoAno));
    params.set("mes", String(novoMes));
    params.delete("geral");
    router.push(`${pathname}?${params.toString()}`);
  }

  function mudarMes(delta: number) {
    let novoMes = mes + delta;
    let novoAno = ano;
    if (novoMes < 1) {
      novoMes = 12;
      novoAno -= 1;
    } else if (novoMes > 12) {
      novoMes = 1;
      novoAno += 1;
    }
    irPara(novoAno, novoMes);
  }

  return (
    <div className="flex items-center gap-2 py-2 text-[12.5px]">
      <button
        type="button"
        onClick={() => mudarMes(-1)}
        aria-label="Mês anterior"
        className="rounded-btn border border-border-neutral px-2 py-1 text-text-secondary hover:bg-card"
      >
        ◀
      </button>
      <span className="min-w-[112px] text-center font-semibold">
        {MESES[mes - 1]} {ano}
      </span>
      <button
        type="button"
        onClick={() => mudarMes(1)}
        aria-label="Próximo mês"
        className="rounded-btn border border-border-neutral px-2 py-1 text-text-secondary hover:bg-card"
      >
        ▶
      </button>
      {!ehMesAtual && (
        <button type="button" onClick={() => irPara(anoAtual, mesAtual)} className="text-[11.5px] text-gold hover:underline">
          Hoje
        </button>
      )}
    </div>
  );
}

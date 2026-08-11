import { revalidatePath } from "next/cache";

/** Todas as telas do hub Financeiro (Visão Geral, Lançamentos, Despesas Fixas,
 * Comprovantes) — chame sempre que um lançamento/comprovante/despesa fixa mudar. */
export function revalidateFinanceiroPaths() {
  revalidatePath("/financeiro/visao-geral");
  revalidatePath("/financeiro/lancamentos");
  revalidatePath("/financeiro/despesas-fixas");
  revalidatePath("/financeiro/despesas-variaveis");
  revalidatePath("/financeiro/comprovantes");
}

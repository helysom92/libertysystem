import { revalidatePath } from "next/cache";

/** Todas as telas do hub Financeiro (Visão Geral, Lançamentos, Despesas,
 * Comprovantes) — chame sempre que um lançamento/comprovante/despesa mudar. */
export function revalidateFinanceiroPaths() {
  revalidatePath("/financeiro/visao-geral");
  revalidatePath("/financeiro/lancamentos");
  revalidatePath("/financeiro/despesas");
  revalidatePath("/financeiro/comprovantes");
  revalidatePath("/financeiro/recebimentos");
}

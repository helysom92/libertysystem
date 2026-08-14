import { revalidatePath } from "next/cache";

/** Todas as telas que listam serviços (Kanban de Orçamentos, Kanban de OS, Visão Geral,
 * Propostas) — chame sempre que um serviço for criado/editado/movido, pra nenhuma delas
 * ficar com dado velho. */
export function revalidateServicoPaths() {
  revalidatePath("/comercial/orcamentos");
  revalidatePath("/comercial/propostas");
  revalidatePath("/producao/servicos");
  revalidatePath("/producao/visao-geral");
  revalidatePath("/financeiro/recebimentos");
}

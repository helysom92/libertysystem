import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cliente } from "@/lib/domain/types";

const PAGE_SIZE = 1000;

/**
 * O Supabase limita cada select a no máximo 1000 linhas por padrão (db-max-rows do
 * PostgREST) — com a base de clientes passando disso, `.select("*")` sozinho corta a
 * lista no meio do alfabeto sem avisar. Isso pagina em blocos de 1000 até esgotar.
 */
export async function fetchAllClientes(
  supabase: SupabaseClient,
  orderBy: { column: string; ascending?: boolean } = { column: "nome", ascending: true }
): Promise<Cliente[]> {
  const all: Cliente[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .order(orderBy.column, { ascending: orderBy.ascending ?? true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as Cliente[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

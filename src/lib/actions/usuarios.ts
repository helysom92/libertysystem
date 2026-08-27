"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/domain/permissions";
import type { Role } from "@/lib/domain/flows";

/** Só Administrador pode alterar a função de um usuário — o trigger `profiles_role_guard`
 * (migration 0034) também bloqueia isso no banco, essa checagem aqui é só pra dar um erro
 * amigável em vez de estourar o erro cru do Postgres. */
export async function updateUserRole(userId: string, role: Role) {
  await requireRole("administrador");
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) throw error;
  revalidatePath("/gestao");
}

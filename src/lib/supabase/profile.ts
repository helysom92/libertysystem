import { createClient } from "./server";
import type { Role } from "@/lib/domain/flows";

export interface Profile {
  id: string;
  nome: string;
  role: Role;
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, nome, role")
    .eq("id", user.id)
    .single();

  return data as Profile | null;
}

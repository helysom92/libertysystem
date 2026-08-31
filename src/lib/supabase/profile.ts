import { cache } from "react";
import { createClient } from "./server";
import type { Role } from "@/lib/domain/flows";

export interface Profile {
  id: string;
  nome: string;
  role: Role;
  email: string;
}

// React's cache() dedupes calls within a single request — the (dashboard) layout
// and every page both call getCurrentProfile(); without this each navigation did
// two separate round trips (auth.getUser() + profiles select) for the same data.
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
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

  if (!data) return null;
  return { ...data, email: user.email ?? "" } as Profile;
});

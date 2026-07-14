import { createClient } from "@/lib/supabase/server";
import type { Material } from "@/lib/domain/types";
import MateriaisList from "@/components/materiais/MateriaisList";

export default async function MateriaisPage() {
  const supabase = await createClient();
  const { data: materiais } = await supabase.from("materiais").select("*").order("nome");

  return <MateriaisList materiais={(materiais as Material[]) ?? []} />;
}

import { createClient } from "@/lib/supabase/server";
import type { Fornecedor } from "@/lib/domain/types";
import FornecedoresList from "@/components/fornecedores/FornecedoresList";

export default async function FornecedoresPage() {
  const supabase = await createClient();
  const { data: fornecedores } = await supabase.from("fornecedores").select("*").order("nome");

  return <FornecedoresList fornecedores={(fornecedores as Fornecedor[]) ?? []} />;
}

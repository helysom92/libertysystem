import { createClient } from "@/lib/supabase/server";
import type { Comprovante } from "@/lib/domain/types";
import ComprovantesSection from "@/components/financeiro/ComprovantesSection";

export default async function FinanceiroComprovantesPage() {
  const supabase = await createClient();
  const { data: comprovantes } = await supabase
    .from("comprovantes")
    .select("*")
    .order("data", { ascending: false });

  return <ComprovantesSection comprovantes={(comprovantes as Comprovante[]) ?? []} />;
}

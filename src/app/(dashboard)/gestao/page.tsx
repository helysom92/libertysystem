import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { createClient } from "@/lib/supabase/server";
import { computeGestaoBuckets } from "@/lib/domain/gestaoBuckets";
import type { Comprovante, Servico } from "@/lib/domain/types";
import BucketCard from "@/components/gestao/BucketCard";

export default async function GestaoPage() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "administrador") {
    redirect("/hoje");
  }

  const supabase = await createClient();
  const [{ data: servicos }, { data: comprovantes }] = await Promise.all([
    supabase.from("servicos").select("*"),
    supabase.from("comprovantes").select("*"),
  ]);

  const buckets = computeGestaoBuckets(
    (servicos as Servico[]) ?? [],
    (comprovantes as Comprovante[]) ?? []
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-xl font-bold">Gestão</h1>
        <p className="text-[13px] text-text-secondary">
          Indicadores, gargalos e visão geral da empresa
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {buckets.map((b) => (
          <BucketCard key={b.titulo} bucket={b} />
        ))}
      </div>
    </div>
  );
}

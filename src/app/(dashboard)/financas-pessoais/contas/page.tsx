import { createClient } from "@/lib/supabase/server";
import { requireHelysom } from "@/lib/domain/permissions";
import { saldoConta } from "@/lib/domain/financasPessoais";
import type { ContaPessoal, ReceitaPessoal, DespesaPessoal, TransferenciaPessoal } from "@/lib/domain/types";
import ContasClient from "@/components/financas-pessoais/ContasClient";
import ErroConsulta from "@/components/financeiro/ErroConsulta";

export default async function ContasPessoaisPage() {
  const profile = await requireHelysom();
  const supabase = await createClient();

  let erro: string | null = null;
  let contas: ContaPessoal[] = [];
  let saldos: Record<string, number> = {};
  let transferenciasList: TransferenciaPessoal[] = [];

  try {
    const [{ data: contasRaw, error: e1 }, { data: receitas, error: e2 }, { data: despesas, error: e3 }, { data: transferencias, error: e4 }] =
      await Promise.all([
        supabase.from("contas_pessoais").select("*").eq("owner_id", profile.id).order("criado_em"),
        supabase.from("receitas_pessoais").select("*").eq("owner_id", profile.id),
        supabase.from("despesas_pessoais").select("*").eq("owner_id", profile.id),
        supabase.from("transferencias_pessoais").select("*").eq("owner_id", profile.id),
      ]);
    const primeiroErro = e1 ?? e2 ?? e3 ?? e4;
    if (primeiroErro) throw primeiroErro;

    contas = (contasRaw as ContaPessoal[]) ?? [];
    const rs = (receitas as ReceitaPessoal[]) ?? [];
    const ds = (despesas as DespesaPessoal[]) ?? [];
    const ts = (transferencias as TransferenciaPessoal[]) ?? [];
    saldos = Object.fromEntries(contas.map((c) => [c.id, saldoConta(c, rs, ds, ts)]));
    transferenciasList = [...ts].sort((a, b) => (a.data < b.data ? 1 : -1)).slice(0, 20);
  } catch (err) {
    console.error("Falha ao carregar Contas (Finanças Pessoais)", err);
    erro = err instanceof Error ? err.message : "erro desconhecido";
  }

  if (erro) return <ErroConsulta mensagem={erro} />;

  return <ContasClient contas={contas} saldos={saldos} transferencias={transferenciasList} />;
}

import { createClient } from "@/lib/supabase/server";
import type { LinhaOrcamento } from "@/lib/domain/orcamento";
import PropostaInterativaPublica from "@/components/proposta/PropostaInterativaPublica";

export interface PropostaInterativaOpcaoPublica {
  linha: LinhaOrcamento;
  titulo: string;
  descricao: string | null;
  valor: number;
}

interface PropostaInterativaPublicaData {
  servico: {
    numero: string | null;
    descricao: string;
    criado_em: string;
    proposta_opcao_escolhida: LinhaOrcamento | null;
    proposta_escolhida_em: string | null;
  };
  cliente: { nome: string };
  opcoes: PropostaInterativaOpcaoPublica[];
}

export default async function PropostaInterativaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  const { data } = await supabase.rpc("get_proposta_interativa", { p_token: token });
  const proposta = data as PropostaInterativaPublicaData | null;

  if (!proposta) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-4">
        <p className="text-[14px] text-text-secondary">
          Essa proposta não foi encontrada ou o link expirou.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg px-4 py-10">
      <PropostaInterativaPublica token={token} proposta={proposta} />
    </div>
  );
}

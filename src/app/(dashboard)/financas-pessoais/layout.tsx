import { requireHelysom } from "@/lib/domain/permissions";
import FinancasPessoaisTabs from "@/components/financas-pessoais/FinancasPessoaisTabs";

export default async function FinancasPessoaisLayout({ children }: { children: React.ReactNode }) {
  // Guarda por identidade (e-mail exato), não por papel — nem outro administrador entra aqui.
  await requireHelysom();

  return (
    <div className="flex h-full flex-col">
      <FinancasPessoaisTabs />
      <div className="mt-5 flex-1">{children}</div>
    </div>
  );
}

import { requireTab } from "@/lib/domain/permissions";
import SecretariaTabs from "@/components/secretaria/SecretariaTabs";

export default async function SecretariaLayout({ children }: { children: React.ReactNode }) {
  await requireTab("secretaria");

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-xl font-bold">Secretaria</h1>
        <p className="text-[13px] text-text-secondary">
          Cadastros e lançamentos do dia a dia
        </p>
      </div>
      <SecretariaTabs />
      <div className="mt-5">{children}</div>
    </div>
  );
}

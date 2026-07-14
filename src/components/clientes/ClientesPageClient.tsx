"use client";

import { useRouter } from "next/navigation";
import type { Cliente, Servico } from "@/lib/domain/types";
import ClientesList from "./ClientesList";

export default function ClientesPageClient({
  clientes,
  servicos,
}: {
  clientes: Cliente[];
  servicos: Servico[];
}) {
  const router = useRouter();
  return <ClientesList clientes={clientes} servicos={servicos} onChanged={() => router.refresh()} />;
}

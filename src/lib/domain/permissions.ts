import { redirect } from "next/navigation";
import { getCurrentProfile, type Profile } from "@/lib/supabase/profile";
import { allowedTabs, homeTabFor, type Role } from "./flows";

/**
 * Guarda de página/layout — chama no topo de todo `layout.tsx`/`page.tsx` que precisa
 * restringir por aba. Redireciona pro login se não há sessão, ou pra home do papel se ele não
 * pode abrir essa aba. Fonte única — substitui a checagem `allowedTabs(role).includes(tab)`
 * que antes estava duplicada em 6 arquivos diferentes.
 */
export async function requireTab(tab: string): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }
  if (!allowedTabs(profile.role).includes(tab)) {
    redirect(`/${homeTabFor(profile.role)}`);
  }
  return profile;
}

/**
 * Guarda de Server Action — primeira linha de toda ação sensível. Lança erro (capturado pelo
 * try/catch que cada modal/formulário já usa pra mostrar mensagem) se o papel de quem chamou
 * não estiver entre os permitidos. Nunca confiar só na interface pra decidir isso.
 */
export async function requireRole(...allowed: Role[]): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile || !allowed.includes(profile.role)) {
    throw new Error("Você não tem permissão para executar essa ação.");
  }
  return profile;
}

/** Só Administrador vê lançamentos de "Retirada de Lucro" — regra da Etapa 1, antes duplicada
 * ad-hoc em `lancamentos/page.tsx` e `despesas/page.tsx`. Fonte única aqui. */
export function podeVerRetiradaDeLucro(role: Role): boolean {
  return role === "administrador";
}

/** Só Administrador vê os indicadores consolidados de resultado (Etapa 3) — Secretaria
 * mantém o operacional (lançar, receber, pagar, consultar), mas não Resultado Realizado/
 * Pendente/Previsto Final nem a memória de cálculo. */
export function podeVerResultadoConsolidado(role: Role): boolean {
  return role === "administrador";
}

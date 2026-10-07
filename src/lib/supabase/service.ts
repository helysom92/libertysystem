import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase server-to-server com a `service_role` key — ignora RLS por completo.
 * Única exceção ao padrão "nunca usar service_role" do projeto (ver README): usado SÓ pela
 * rota de Cron de sincronização do Mercado Pago (`src/app/api/cron/sync-mercadopago`), que
 * não tem cookie de sessão de usuário pra autenticar do jeito normal. Nunca importar isso em
 * código que roda numa requisição de usuário (Server Action, Server Component, etc.).
 */
export function createServiceClient() {
  return createClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim(),
    (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim(),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

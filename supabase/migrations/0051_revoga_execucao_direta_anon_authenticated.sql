-- Etapa 4A.1 — Correção da correção: a migration 0046 revogava EXECUTE só de PUBLIC, partindo
-- do pressuposto de que anon/authenticated herdavam acesso via PUBLIC (comportamento padrão
-- "cru" do Postgres). Confirmado ao vivo, via consulta direta ao catálogo do banco
-- (information_schema.role_routine_grants), que isso estava errado nesse projeto: o Supabase
-- concede EXECUTE em toda função nova do schema public DIRETAMENTE pros papéis anon,
-- authenticated e service_role (provavelmente via ALTER DEFAULT PRIVILEGES configurado pelo
-- próprio Supabase na criação do projeto) — não é herdado de PUBLIC. Por isso a migration 0046
-- não teve efeito nenhum: revogar de PUBLIC não tira uma concessão que nunca passou por ali.
--
-- Correção real: revoga EXECUTE explicitamente de anon E authenticated (além de PUBLIC, por
-- garantia) em cada função, e concede de volta só pro que precisa. Também ajusta o privilégio
-- padrão do schema pra futuras funções não nascerem mais com esse acesso direto.

alter default privileges in schema public revoke execute on functions from anon, authenticated;

-- ── Authenticated só (empresarial/financeiro) ──────────────────────────────────────────────
revoke execute on function aprova_orcamento(uuid) from public, anon, authenticated;
grant execute on function aprova_orcamento(uuid) to authenticated;

revoke execute on function cancelar_servico(uuid, text) from public, anon, authenticated;
grant execute on function cancelar_servico(uuid, text) to authenticated;

revoke execute on function move_card_para_coluna(uuid, uuid) from public, anon, authenticated;
grant execute on function move_card_para_coluna(uuid, uuid) to authenticated;

revoke execute on function get_servico_producao(uuid) from public, anon, authenticated;
grant execute on function get_servico_producao(uuid) to authenticated;

revoke execute on function listar_servicos_producao() from public, anon, authenticated;
grant execute on function listar_servicos_producao() to authenticated;

revoke execute on function find_or_create_cliente(text, text) from public, anon, authenticated;
grant execute on function find_or_create_cliente(text, text) to authenticated;

revoke execute on function ensure_share_token(uuid) from public, anon, authenticated;
grant execute on function ensure_share_token(uuid) to authenticated;

revoke execute on function estornar_pagamento_parcela(uuid, text) from public, anon, authenticated;
grant execute on function estornar_pagamento_parcela(uuid, text) to authenticated;

revoke execute on function registrar_recebimento_parcela(uuid, numeric, date, text) from public, anon, authenticated;
grant execute on function registrar_recebimento_parcela(uuid, numeric, date, text) to authenticated;

revoke execute on function estornar_recebimento_parcela(uuid, text) from public, anon, authenticated;
grant execute on function estornar_recebimento_parcela(uuid, text) to authenticated;

revoke execute on function toggle_despesa_fixa_ocorrencia(uuid, int, int, boolean) from public, anon, authenticated;
grant execute on function toggle_despesa_fixa_ocorrencia(uuid, int, int, boolean) to authenticated;

revoke execute on function toggle_despesa_variavel_ocorrencia(uuid, int, int, boolean) from public, anon, authenticated;
grant execute on function toggle_despesa_variavel_ocorrencia(uuid, int, int, boolean) to authenticated;

revoke execute on function registrar_pagamento_despesa_fixa_ocorrencia(uuid, int, int, numeric, date) from public, anon, authenticated;
grant execute on function registrar_pagamento_despesa_fixa_ocorrencia(uuid, int, int, numeric, date) to authenticated;

revoke execute on function registrar_pagamento_despesa_variavel_ocorrencia(uuid, int, int, numeric, date) from public, anon, authenticated;
grant execute on function registrar_pagamento_despesa_variavel_ocorrencia(uuid, int, int, numeric, date) to authenticated;

revoke execute on function estornar_pagamento_despesa_fixa_ocorrencia(uuid, text) from public, anon, authenticated;
grant execute on function estornar_pagamento_despesa_fixa_ocorrencia(uuid, text) to authenticated;

revoke execute on function estornar_pagamento_despesa_variavel_ocorrencia(uuid, text) from public, anon, authenticated;
grant execute on function estornar_pagamento_despesa_variavel_ocorrencia(uuid, text) to authenticated;

revoke execute on function registrar_recebimento_pessoal(uuid, numeric, date, uuid) from public, anon, authenticated;
grant execute on function registrar_recebimento_pessoal(uuid, numeric, date, uuid) to authenticated;

revoke execute on function estornar_recebimento_pessoal(uuid, text) from public, anon, authenticated;
grant execute on function estornar_recebimento_pessoal(uuid, text) to authenticated;

revoke execute on function registrar_pagamento_pessoal(uuid, numeric, date, uuid) from public, anon, authenticated;
grant execute on function registrar_pagamento_pessoal(uuid, numeric, date, uuid) to authenticated;

revoke execute on function estornar_pagamento_pessoal(uuid, text) from public, anon, authenticated;
grant execute on function estornar_pagamento_pessoal(uuid, text) to authenticated;

revoke execute on function registrar_pagamento_divida_pessoal(uuid, numeric, date, uuid) from public, anon, authenticated;
grant execute on function registrar_pagamento_divida_pessoal(uuid, numeric, date, uuid) to authenticated;

revoke execute on function estornar_pagamento_divida_pessoal(uuid, text) from public, anon, authenticated;
grant execute on function estornar_pagamento_divida_pessoal(uuid, text) to authenticated;

revoke execute on function registrar_movimento_investimento_pessoal(uuid, tipo_movimento_investimento_pessoal, numeric, date, uuid) from public, anon, authenticated;
grant execute on function registrar_movimento_investimento_pessoal(uuid, tipo_movimento_investimento_pessoal, numeric, date, uuid) to authenticated;

revoke execute on function estornar_movimento_investimento_pessoal(uuid, text) from public, anon, authenticated;
grant execute on function estornar_movimento_investimento_pessoal(uuid, text) to authenticated;

revoke execute on function auth_role() from public, anon, authenticated;
grant execute on function auth_role() to authenticated;

revoke execute on function is_admin() from public, anon, authenticated;
grant execute on function is_admin() to authenticated;

revoke execute on function is_admin_or_producao() from public, anon, authenticated;
grant execute on function is_admin_or_producao() to authenticated;

revoke execute on function is_admin_or_secretaria() from public, anon, authenticated;
grant execute on function is_admin_or_secretaria() to authenticated;

revoke execute on function is_helysom() from public, anon, authenticated;
grant execute on function is_helysom() to authenticated;

-- ── As 3 deliberadamente públicas — revoga e concede de volta explicitamente pros dois ──────
revoke execute on function get_proposta_publica(uuid) from public, anon, authenticated;
grant execute on function get_proposta_publica(uuid) to authenticated, anon;

revoke execute on function get_proposta_interativa(uuid) from public, anon, authenticated;
grant execute on function get_proposta_interativa(uuid) to authenticated, anon;

revoke execute on function escolher_proposta(uuid, linha_orcamento) from public, anon, authenticated;
grant execute on function escolher_proposta(uuid, linha_orcamento) to authenticated, anon;

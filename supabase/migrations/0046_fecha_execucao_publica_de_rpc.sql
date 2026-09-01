-- Etapa 4A.1 — Fecha uma vulnerabilidade crítica real, confirmada ao vivo contra produção:
-- toda função `security definer` criada neste projeto NUNCA teve seu privilégio padrão do
-- Postgres revogado. Por padrão, `create function` concede EXECUTE a `PUBLIC` — e no Supabase,
-- isso significa que os papéis `anon` (visitante sem login nenhum) e `authenticated` herdam
-- esse acesso automaticamente, mesmo sem nenhum `grant` explícito.
--
-- Confirmado com uma chamada real, sem token de autenticação nenhum, só a anon key (pública):
--   POST /rest/v1/rpc/aprova_orcamento        -> executou (não foi "permission denied")
--   POST /rest/v1/rpc/move_card_para_coluna   -> executou (não foi "permission denied")
-- Ou seja: qualquer pessoa na internet, sem login, já conseguia aprovar orçamento, mover card
-- de coluna, e (por extensão, mesmo desenho) provavelmente cancelar serviço, registrar/estornar
-- pagamento e todo o resto das RPCs sensíveis do sistema — mesmo sem NENHUMA credencial.
--
-- Correção: revoga EXECUTE de PUBLIC em toda função de negócio, concede de volta só pro papel
-- que precisa (`authenticated` pras internas; `authenticated` + `anon` só nas 3 que são
-- deliberadamente públicas — link de proposta pro cliente, sem login). Também muda o privilégio
-- padrão do schema `public` pra qualquer função NOVA já nascer sem esse buraco.
--
-- Nunca reescreve as funções em si (só GRANT/REVOKE) — nenhuma lógica de negócio muda aqui.

-- ── Fecha o buraco por padrão pra qualquer função nova daqui pra frente ───────────────────────
alter default privileges in schema public revoke execute on functions from public;

-- ── Kanban / Serviços / Clientes (empresarial) — só authenticated ─────────────────────────────
revoke execute on function aprova_orcamento(uuid) from public;
grant execute on function aprova_orcamento(uuid) to authenticated;

revoke execute on function cancelar_servico(uuid, text) from public;
grant execute on function cancelar_servico(uuid, text) to authenticated;

revoke execute on function move_card_para_coluna(uuid, uuid) from public;
grant execute on function move_card_para_coluna(uuid, uuid) to authenticated;

revoke execute on function get_servico_producao(uuid) from public;
grant execute on function get_servico_producao(uuid) to authenticated;

revoke execute on function listar_servicos_producao() from public;
grant execute on function listar_servicos_producao() to authenticated;

revoke execute on function find_or_create_cliente(text, text) from public;
grant execute on function find_or_create_cliente(text, text) to authenticated;

revoke execute on function ensure_share_token(uuid) from public;
grant execute on function ensure_share_token(uuid) to authenticated;

-- ── Financeiro (parcelas e despesas recorrentes) — só authenticated ────────────────────────────
revoke execute on function estornar_pagamento_parcela(uuid, text) from public;
grant execute on function estornar_pagamento_parcela(uuid, text) to authenticated;

revoke execute on function registrar_recebimento_parcela(uuid, numeric, date, text) from public;
grant execute on function registrar_recebimento_parcela(uuid, numeric, date, text) to authenticated;

revoke execute on function estornar_recebimento_parcela(uuid, text) from public;
grant execute on function estornar_recebimento_parcela(uuid, text) to authenticated;

revoke execute on function toggle_despesa_fixa_ocorrencia(uuid, int, int, boolean) from public;
grant execute on function toggle_despesa_fixa_ocorrencia(uuid, int, int, boolean) to authenticated;

revoke execute on function toggle_despesa_variavel_ocorrencia(uuid, int, int, boolean) from public;
grant execute on function toggle_despesa_variavel_ocorrencia(uuid, int, int, boolean) to authenticated;

revoke execute on function registrar_pagamento_despesa_fixa_ocorrencia(uuid, int, int, numeric, date) from public;
grant execute on function registrar_pagamento_despesa_fixa_ocorrencia(uuid, int, int, numeric, date) to authenticated;

revoke execute on function registrar_pagamento_despesa_variavel_ocorrencia(uuid, int, int, numeric, date) from public;
grant execute on function registrar_pagamento_despesa_variavel_ocorrencia(uuid, int, int, numeric, date) to authenticated;

revoke execute on function estornar_pagamento_despesa_fixa_ocorrencia(uuid, text) from public;
grant execute on function estornar_pagamento_despesa_fixa_ocorrencia(uuid, text) to authenticated;

revoke execute on function estornar_pagamento_despesa_variavel_ocorrencia(uuid, text) from public;
grant execute on function estornar_pagamento_despesa_variavel_ocorrencia(uuid, text) to authenticated;

-- ── Finanças Pessoais — só authenticated (a própria RPC ainda confere is_helysom()+owner_id
--    por dentro, isso aqui é uma segunda camada, defesa em profundidade) ───────────────────────
revoke execute on function registrar_recebimento_pessoal(uuid, numeric, date, uuid) from public;
grant execute on function registrar_recebimento_pessoal(uuid, numeric, date, uuid) to authenticated;

revoke execute on function estornar_recebimento_pessoal(uuid, text) from public;
grant execute on function estornar_recebimento_pessoal(uuid, text) to authenticated;

revoke execute on function registrar_pagamento_pessoal(uuid, numeric, date, uuid) from public;
grant execute on function registrar_pagamento_pessoal(uuid, numeric, date, uuid) to authenticated;

revoke execute on function estornar_pagamento_pessoal(uuid, text) from public;
grant execute on function estornar_pagamento_pessoal(uuid, text) to authenticated;

revoke execute on function registrar_pagamento_divida_pessoal(uuid, numeric, date, uuid) from public;
grant execute on function registrar_pagamento_divida_pessoal(uuid, numeric, date, uuid) to authenticated;

revoke execute on function estornar_pagamento_divida_pessoal(uuid, text) from public;
grant execute on function estornar_pagamento_divida_pessoal(uuid, text) to authenticated;

revoke execute on function registrar_movimento_investimento_pessoal(uuid, tipo_movimento_investimento_pessoal, numeric, date, uuid) from public;
grant execute on function registrar_movimento_investimento_pessoal(uuid, tipo_movimento_investimento_pessoal, numeric, date, uuid) to authenticated;

revoke execute on function estornar_movimento_investimento_pessoal(uuid, text) from public;
grant execute on function estornar_movimento_investimento_pessoal(uuid, text) to authenticated;

-- ── Helpers de papel usados dentro de policy RLS — authenticated precisa continuar
--    conseguindo chamar (senão toda policy que usa is_admin_or_secretaria() etc. quebra pra
--    usuário logado também); anon nunca precisa, já que nenhuma tabela protegida por essas
--    policies deveria ser tocada por anon de qualquer forma ─────────────────────────────────
revoke execute on function auth_role() from public;
grant execute on function auth_role() to authenticated;

revoke execute on function is_admin() from public;
grant execute on function is_admin() to authenticated;

revoke execute on function is_admin_or_producao() from public;
grant execute on function is_admin_or_producao() to authenticated;

revoke execute on function is_admin_or_secretaria() from public;
grant execute on function is_admin_or_secretaria() to authenticated;

revoke execute on function is_helysom() from public;
grant execute on function is_helysom() to authenticated;

-- ── As 3 únicas RPCs deliberadamente públicas (link de proposta pro cliente, sem login) —
--    controle de acesso real é o token aleatório (share_token), não a ausência de GRANT ────────
revoke execute on function get_proposta_publica(uuid) from public;
grant execute on function get_proposta_publica(uuid) to authenticated, anon;

revoke execute on function get_proposta_interativa(uuid) from public;
grant execute on function get_proposta_interativa(uuid) to authenticated, anon;

revoke execute on function escolher_proposta(uuid, linha_orcamento) from public;
grant execute on function escolher_proposta(uuid, linha_orcamento) to authenticated, anon;

-- Etapa 4A.3/4A.5 — Re-auditoria confirmou 2 vazamentos reais de leitura, via RLS (não pelo
-- app/RPC, que já estão corretos): `orcamento_itens` e `clientes` ainda tinham policy de
-- select `using (auth.role() = 'authenticated')` — ou seja, mesmo com toda a camada de app já
-- certa (Produção usa get_servico_producao/listar_servicos_producao, que devolvem só campo
-- operacional; CentralDoServico não passa custo/preço pra Produção), um usuário de Produção
-- autenticado ainda conseguia ler a tabela `orcamento_itens` (custo_direto, preco_m2_manual,
-- valor_final) e `clientes` (cpf_cnpj e demais campos) direto via Supabase REST/console —
-- bypassando toda a camada de app.
--
-- `servicos`, `servico_parcelas` e `itens_orcamento` já estavam corretos (select restrito a
-- is_admin_or_secretaria(), confirmado por leitura das migrations 0037/0034/0005 — nenhuma
-- migration posterior afrouxa essas 3).
--
-- Produção não precisa de select direto nem em `orcamento_itens` nem em `clientes` — tudo que
-- legitimamente usa (nome/whatsapp do cliente, descrição/medidas do item) já vem escrutinado
-- pela função get_servico_producao (security definer, não afetada por RLS).

drop policy if exists orcamento_itens_select on orcamento_itens;
create policy orcamento_itens_select on orcamento_itens for select using (is_admin_or_secretaria());

drop policy if exists clientes_select on clientes;
create policy clientes_select on clientes for select using (is_admin_or_secretaria());

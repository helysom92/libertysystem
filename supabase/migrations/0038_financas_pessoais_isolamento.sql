-- Finanças Pessoais — Bloco A: isolamento de dados e acesso exclusivo.
--
-- Ainda não cria nenhuma tabela de dado pessoal (contas/receitas/despesas ficam pro Bloco B).
-- Só a função de identidade que toda tabela pessoal futura vai usar na RLS: checa o e-mail do
-- JWT autenticado (auth.email(), assinado pelo Supabase Auth — não é um dado que o navegador
-- consegue alterar), não o papel do usuário. Isso garante que nem outro administrador ganha
-- acesso automático ao módulo.
create or replace function is_helysom() returns boolean
language sql stable as $$
  select auth.email() = 'helysomms@gmail.com'
$$;

comment on function is_helysom() is
  'Verdadeiro só para a sessão autenticada do Helysom (por e-mail do JWT). Usado como condição de RLS em toda tabela do módulo Finanças Pessoais.';

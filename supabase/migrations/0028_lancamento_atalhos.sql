-- Atalhos de lançamento — pra despesas recorrentes que não são fixas (valor e data variam
-- toda vez, ex: Combustível, Terceirização), diferente de Despesas Fixas (valor fixo, um dia
-- certo por mês) e Despesas Variáveis (uma ocorrência por mês, valor editável). Um atalho
-- guarda só o "molde" (descrição/categoria/fornecedor/forma de pagamento padrão); cada uso
-- lança um `lancamentos` novo perguntando só valor e data.
create table lancamento_atalhos (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  categoria text not null default 'Geral',
  fornecedor_id uuid references fornecedores(id) on delete set null,
  forma_pagamento text,
  ordem int not null default 0,
  ativo boolean not null default true
);
create index lancamento_atalhos_ordem_idx on lancamento_atalhos(ordem);

alter table lancamento_atalhos enable row level security;
create policy lancamento_atalhos_all on lancamento_atalhos for all using (is_admin_or_secretaria());

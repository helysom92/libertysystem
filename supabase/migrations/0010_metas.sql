-- Sistema Liberty — Fase 6: metas de acompanhamento pro Dashboard administrativo.

create type meta_tipo as enum ('vendas_mensais', 'despesas_mensais', 'novos_clientes', 'margem_liquida');

create table metas (
  id uuid primary key default gen_random_uuid(),
  tipo meta_tipo not null unique,
  valor_alvo numeric(12,2) not null default 0,
  atualizado_em timestamptz not null default now()
);

alter table metas enable row level security;
create policy metas_all on metas for all using (is_admin_or_secretaria());

insert into metas (tipo, valor_alvo) values
  ('vendas_mensais', 0),
  ('despesas_mensais', 0),
  ('novos_clientes', 0),
  ('margem_liquida', 0);

create table fechamentos_mensais (
  id uuid primary key default gen_random_uuid(),
  ano int not null,
  mes int not null,
  entrou numeric(12,2) not null default 0,
  saiu numeric(12,2) not null default 0,
  lucro numeric(12,2) not null default 0,
  fechado_em timestamptz not null default now(),
  fechado_por uuid references profiles(id),
  unique (ano, mes)
);

alter table fechamentos_mensais enable row level security;
create policy fechamentos_mensais_all on fechamentos_mensais for all using (is_admin_or_secretaria());

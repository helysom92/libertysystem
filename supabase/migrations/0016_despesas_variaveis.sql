-- Despesas variáveis (água, energia, comissão etc.) — diferente de despesas_fixas: não tem
-- um valor fixo nem dia de vencimento certo. Cada uma tem um valor_provisionado (estimativa
-- mensal) que serve de referência, e o valor real de cada mês é editado manualmente na
-- ocorrência conforme a conta chega.
create table despesas_variaveis (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  valor_provisionado numeric(12,2) not null default 0,
  categoria text,
  fornecedor_id uuid references fornecedores(id) on delete set null,
  ativo boolean not null default true
);

create table despesas_variaveis_ocorrencias (
  id uuid primary key default gen_random_uuid(),
  despesa_variavel_id uuid not null references despesas_variaveis(id) on delete cascade,
  ano int not null,
  mes int not null check (mes between 1 and 12),
  valor_real numeric(12,2),
  pago boolean not null default false,
  pago_em timestamptz,
  unique (despesa_variavel_id, ano, mes)
);
create index despesas_variaveis_ocorrencias_periodo_idx on despesas_variaveis_ocorrencias(ano, mes);

alter table despesas_variaveis enable row level security;
alter table despesas_variaveis_ocorrencias enable row level security;
create policy despesas_variaveis_all on despesas_variaveis for all using (is_admin_or_secretaria());
create policy despesas_variaveis_ocorrencias_all on despesas_variaveis_ocorrencias for all using (is_admin_or_secretaria());

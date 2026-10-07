-- Etapa A (revisão diária / memória de comportamentos):
-- 1) lançamentos passam a ter unidade de negócio (null = Comunicação Visual, o histórico não
--    muda; "Digital" só quando marcado de propósito, pra não misturar nos relatórios);
-- 2) movimentos sincronizados do Mercado Pago ganham o nome do pagador e um "ignorado";
-- 3) regras aprendidas ("todo mês recebo da Agência Lupa = Digital") — só Administrador cria.

alter table lancamentos add column unidade_negocio unidade_negocio;

alter table mercadopago_movimentos
  add column contraparte text,
  add column ignorado_em timestamptz;

create table regras_lancamento (
  id uuid primary key default gen_random_uuid(),
  padrao text not null check (length(btrim(padrao)) > 0),
  tipo text check (tipo in ('Receita', 'Despesa')),
  categoria text,
  unidade_negocio unidade_negocio,
  recorrencia text not null default 'nenhuma' check (recorrencia in ('nenhuma', 'mensal')),
  valor_tipico numeric(12,2),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  criado_por uuid references profiles(id)
);

alter table regras_lancamento enable row level security;

create policy regras_lancamento_select on regras_lancamento
  for select using (is_admin_or_secretaria());

create policy regras_lancamento_insert on regras_lancamento
  for insert with check (is_admin());

create policy regras_lancamento_update on regras_lancamento
  for update using (is_admin());

create policy regras_lancamento_delete on regras_lancamento
  for delete using (is_admin());

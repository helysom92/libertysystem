-- Sistema Liberty — Fase 2: Fornecedores, Materiais, fluxo de caixa, status de cliente, capa do card
-- See C:\Users\DellUser\.claude\plans\replicated-scribbling-flame.md for rationale.

-- ── Fornecedores ──────────────────────────────────────────────────────
create table fornecedores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria text,
  telefone text,
  email text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table lancamentos add column fornecedor_id uuid references fornecedores(id) on delete set null;
alter table despesas_fixas add column fornecedor_id uuid references fornecedores(id) on delete set null;

-- ── Financeiro: fluxo de caixa dia-a-dia ──────────────────────────────
create type lancamento_status as enum ('previsto', 'realizado', 'cancelado');
alter table lancamentos add column banco text;
alter table lancamentos add column forma_pagamento text;
alter table lancamentos add column status lancamento_status not null default 'realizado';

-- ── Clientes: status de cadastro ──────────────────────────────────────
create type cliente_status as enum ('pre_cadastro', 'regularizado', 'inativo');
alter table clientes add column status cliente_status not null default 'regularizado';

-- ── Materiais: catálogo de custo para a calculadora de orçamento ──────
create table materiais (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  unidade text not null,
  preco_unitario numeric(10,2) not null,
  categoria text,
  ativo boolean not null default true
);

-- ── Kanban: capa de imagem do card ────────────────────────────────────
alter table servicos add column capa_foto_id uuid references fotos(id) on delete set null;

-- ── RLS ────────────────────────────────────────────────────────────────
alter table fornecedores enable row level security;
alter table materiais enable row level security;

create policy fornecedores_all on fornecedores for all using (is_admin_or_secretaria());
create policy materiais_all on materiais for all using (is_admin_or_secretaria());

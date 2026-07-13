-- Sistema Liberty — initial schema
-- See C:\Users\DellUser\.claude\plans\replicated-scribbling-flame.md §2 for rationale.

create extension if not exists pgcrypto;

-- ── Enums ──────────────────────────────────────────────────────────────
create type role_enum as enum ('administrador','secretaria','producao');
create type servico_tipo as enum ('medida_instalacao','medida_sem_instalacao','simples','criacao');
create type prioridade_enum as enum ('Normal','Alta','Urgente');
create type financeiro_status_enum as enum (
  'Não orçado','Orçado','Aguardando sinal','Parcialmente pago','Pago','Vencido','Cancelado','Cortesia'
);
create type unidade_enum as enum ('m','cm','mm');
create type status_revisao_enum as enum ('Pendente','Confirmada');
create type evento_tipo as enum ('Visita Técnica','Instalação','Entrega','Reunião','Retorno');
create type lancamento_tipo as enum ('Receita','Despesa');
create type comprovante_status as enum ('pendente','confirmado');

-- ── profiles (1:1 with auth.users) ────────────────────────────────────
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  role role_enum not null default 'secretaria',
  created_at timestamptz not null default now()
);

-- ── clientes ───────────────────────────────────────────────────────────
create table clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  nome_lower text generated always as (lower(nome)) stored,
  empresa text,
  cpf_cnpj text,
  cidade text,
  endereco text,
  whatsapp text,
  observacoes text,
  created_at timestamptz not null default now()
);
create unique index clientes_nome_lower_idx on clientes(nome_lower);

-- ── servicos (central entity) ────────────────────────────────────────────
create sequence servico_numero_seq start 1001;

create table servicos (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique default ('SRV-' || nextval('servico_numero_seq')),
  cliente_id uuid not null references clientes(id),
  cliente text not null,
  descricao text not null,
  valor numeric(12,2) not null default 0,
  valor_pago numeric(12,2) not null default 0,
  tipo servico_tipo not null,
  estagio text not null,
  prazo date,
  criado_em timestamptz not null default now(),
  concluido_em timestamptz,
  responsavel text not null default '',
  prioridade prioridade_enum not null default 'Normal',
  financeiro_status financeiro_status_enum not null default 'Não orçado',
  entrega_confirmada boolean not null default false,
  liberado_admin boolean not null default false,
  proxima_acao_texto text,
  proxima_responsavel text,
  proxima_prazo text,
  motivo_espera text,
  dc_admin jsonb not null default '[]',
  dc_producao jsonb not null default '[]',
  dc_invalidated_after_advance boolean not null default false
);
create index servicos_estagio_idx on servicos(estagio);
create index servicos_tipo_idx on servicos(tipo);
create index servicos_financeiro_status_idx on servicos(financeiro_status);
create index servicos_prazo_idx on servicos(prazo);
create index servicos_cliente_id_idx on servicos(cliente_id);

-- keep servicos.cliente denormalized name in sync with clientes.nome
create or replace function sync_servico_cliente_nome() returns trigger
language plpgsql as $$
begin
  if NEW.nome is distinct from OLD.nome then
    update servicos set cliente = NEW.nome where cliente_id = NEW.id;
  end if;
  return NEW;
end;
$$;
create trigger clientes_sync_nome after update on clientes
  for each row execute function sync_servico_cliente_nome();

-- ── child collections ──────────────────────────────────────────────────
create table medicoes (
  id uuid primary key default gen_random_uuid(),
  servico_id uuid not null references servicos(id) on delete cascade,
  largura numeric,
  altura numeric,
  profundidade numeric,
  unidade unidade_enum not null,
  quantidade int not null default 1,
  local_medicao text,
  responsavel text,
  data date not null default current_date,
  observacoes text,
  status_revisao status_revisao_enum not null default 'Pendente'
);
create index medicoes_servico_id_idx on medicoes(servico_id);

create table arquivos (
  id uuid primary key default gen_random_uuid(),
  servico_id uuid not null references servicos(id) on delete cascade,
  nome text not null,
  storage_path text not null,
  tamanho_bytes bigint,
  content_type text,
  uploaded_by uuid references profiles(id),
  criado_em timestamptz not null default now()
);
create index arquivos_servico_id_idx on arquivos(servico_id);

create table fotos (
  id uuid primary key default gen_random_uuid(),
  servico_id uuid not null references servicos(id) on delete cascade,
  slot int not null check (slot between 1 and 3),
  storage_path text,
  crop jsonb,
  unique (servico_id, slot)
);

create table checklist_items (
  id uuid primary key default gen_random_uuid(),
  servico_id uuid not null references servicos(id) on delete cascade,
  texto text not null,
  done boolean not null default false,
  ordem int not null default 0
);
create index checklist_items_servico_id_idx on checklist_items(servico_id);

create table timeline_entries (
  id uuid primary key default gen_random_uuid(),
  servico_id uuid not null references servicos(id) on delete cascade,
  texto text not null,
  criado_em timestamptz not null default now()
);
create index timeline_entries_servico_id_idx on timeline_entries(servico_id);

create table historico_entries (
  id uuid primary key default gen_random_uuid(),
  servico_id uuid not null references servicos(id) on delete cascade,
  texto text not null,
  criado_em timestamptz not null default now()
);
create index historico_entries_servico_id_idx on historico_entries(servico_id);

-- ── agenda (real date field, decision #4) ────────────────────────────────
create table eventos (
  id uuid primary key default gen_random_uuid(),
  data date not null default current_date,
  hora time not null,
  tipo evento_tipo not null,
  servico_id uuid references servicos(id) on delete set null,
  cliente text,
  endereco text,
  responsavel text,
  whatsapp text
);
create index eventos_data_idx on eventos(data);

-- ── financeiro ────────────────────────────────────────────────────────
create table lancamentos (
  id uuid primary key default gen_random_uuid(),
  tipo lancamento_tipo not null,
  descricao text not null,
  categoria text,
  valor numeric(12,2) not null,
  data date not null default current_date,
  servico_id uuid references servicos(id) on delete set null
);
create index lancamentos_servico_id_idx on lancamentos(servico_id);
create index lancamentos_data_idx on lancamentos(data);

create table despesas_fixas (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  valor numeric(12,2) not null,
  dia_vencimento int not null check (dia_vencimento between 1 and 31),
  categoria text,
  ativo boolean not null default true
);

create table despesas_fixas_ocorrencias (
  id uuid primary key default gen_random_uuid(),
  despesa_fixa_id uuid not null references despesas_fixas(id) on delete cascade,
  ano int not null,
  mes int not null check (mes between 1 and 12),
  pago boolean not null default false,
  pago_em timestamptz,
  unique (despesa_fixa_id, ano, mes)
);
create index despesas_fixas_ocorrencias_periodo_idx on despesas_fixas_ocorrencias(ano, mes);

create table comprovantes (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  banco text,
  valor numeric(12,2) not null,
  data date not null default current_date,
  status comprovante_status not null default 'pendente',
  servico_id uuid references servicos(id) on delete set null
);
create index comprovantes_status_idx on comprovantes(status);

-- ── new-user → profile bootstrap ─────────────────────────────────────
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, nome, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', new.email), 'secretaria');
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

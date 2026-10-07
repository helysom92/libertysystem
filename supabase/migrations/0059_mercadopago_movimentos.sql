-- Tabela espelho dos movimentos brutos sincronizados da API do Mercado Pago (sincronização
-- automática de extrato). Só a rota de Cron (service_role, sem sessão de usuário) escreve
-- aqui — por isso não existe policy de insert pra anon/authenticated, só select/update pra
-- quem já podia ver o financeiro. A conciliação de verdade (virar lançamento) continua
-- exigindo um Admin logado clicando "Lançar" na tela de Conferência, como já acontecia com o
-- upload de PDF.
create table mercadopago_movimentos (
  id uuid primary key default gen_random_uuid(),
  mp_id text not null unique,
  data date not null,
  valor numeric(12,2) not null,
  tipo text not null check (tipo in ('Receita','Despesa')),
  descricao text not null,
  tipo_mp_bruto text,
  conciliado boolean not null default false,
  lancamento_id uuid references lancamentos(id) on delete set null,
  criado_em timestamptz not null default now()
);

create index mercadopago_movimentos_data_idx on mercadopago_movimentos(data);

alter table mercadopago_movimentos enable row level security;

create policy mercadopago_movimentos_select on mercadopago_movimentos
  for select using (is_admin_or_secretaria());

create policy mercadopago_movimentos_update on mercadopago_movimentos
  for update using (is_admin_or_secretaria());

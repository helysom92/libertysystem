-- Pagamentos por serviço: sinal/restante ou quantas parcelas forem necessárias, cada uma com
-- valor previsto + data prevista, e valor/data reais quando confirmada. Substitui o campo único
-- "Valor Pago" por uma lista flexível — cobre entrada+restante fixos, atraso combinado com o
-- cliente, ou parcelamento em mais vezes, tudo com a mesma estrutura.
create table servico_parcelas (
  id uuid primary key default gen_random_uuid(),
  servico_id uuid not null references servicos(id) on delete cascade,
  ordem int not null default 0,
  descricao text not null,
  valor_previsto numeric(12,2) not null default 0,
  data_prevista date,
  valor_pago numeric(12,2),
  pago_em timestamptz,
  forma_pagamento text,
  lancamento_id uuid references lancamentos(id) on delete set null
);
create index servico_parcelas_servico_id_idx on servico_parcelas(servico_id);

alter table servico_parcelas enable row level security;
create policy servico_parcelas_all on servico_parcelas for all using (auth.role() = 'authenticated');

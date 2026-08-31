-- Finanças Pessoais — Bloco B: contas, receitas, despesas e transferências.
--
-- Toda tabela deste bloco segue o mesmo padrão de isolamento: owner_id default auth.uid(),
-- RLS exige is_helysom() (migration 0038) E owner_id = auth.uid() em toda operação — mesmo
-- ele não consegue gravar em nome de outro usuário, e nenhum outro usuário (nem outro
-- administrador) passa por is_helysom(). Ledgers de recebimento/pagamento espelham o padrão já
-- comprovado em parcela_recebimentos/despesa_ocorrencia_pagamentos (migration 0037) — permite
-- estorno granular sem apagar histórico.

-- ── Contas pessoais ─────────────────────────────────────────────────────────────────────────
create table contas_pessoais (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references profiles(id),
  nome text not null,
  instituicao text,
  tipo text,
  saldo_inicial numeric(12,2) not null default 0,
  data_saldo_inicial date not null,
  ativa boolean not null default true,
  criado_em timestamptz not null default now()
);
alter table contas_pessoais enable row level security;
create policy contas_pessoais_select on contas_pessoais for select using (owner_id = auth.uid() and is_helysom());
create policy contas_pessoais_insert on contas_pessoais for insert with check (owner_id = auth.uid() and is_helysom());
create policy contas_pessoais_update on contas_pessoais for update using (owner_id = auth.uid() and is_helysom()) with check (owner_id = auth.uid() and is_helysom());
create policy contas_pessoais_delete on contas_pessoais for delete using (owner_id = auth.uid() and is_helysom());

-- ── Origens de receita (catálogo editável — Pró-labore I9, digital, avulsas, outras) ─────────
create table origens_receita_pessoal (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references profiles(id),
  nome text not null,
  ativo boolean not null default true
);
alter table origens_receita_pessoal enable row level security;
create policy origens_receita_pessoal_select on origens_receita_pessoal for select using (owner_id = auth.uid() and is_helysom());
create policy origens_receita_pessoal_insert on origens_receita_pessoal for insert with check (owner_id = auth.uid() and is_helysom());
create policy origens_receita_pessoal_update on origens_receita_pessoal for update using (owner_id = auth.uid() and is_helysom()) with check (owner_id = auth.uid() and is_helysom());
create policy origens_receita_pessoal_delete on origens_receita_pessoal for delete using (owner_id = auth.uid() and is_helysom());

-- ── Receitas pessoais ────────────────────────────────────────────────────────────────────────
-- Uma linha "recorrente" (recorrencia <> 'unica') funciona como modelo: o Helysom duplica pro
-- próximo período manualmente (ação "Duplicar pro próximo mês"), sem geração automática — mais
-- simples que o padrão empresarial de ocorrências e suficiente pro uso pessoal.
create type recorrencia_pessoal as enum ('unica', 'mensal', 'semanal', 'anual');
create type situacao_receita_pessoal as enum ('prevista', 'parcial', 'recebida', 'cancelada');

create table receitas_pessoais (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references profiles(id),
  descricao text not null,
  origem_id uuid references origens_receita_pessoal(id),
  pagador text,
  categoria text,
  valor_previsto numeric(12,2) not null check (valor_previsto > 0),
  valor_recebido numeric(12,2) not null default 0,
  conta_destino_id uuid references contas_pessoais(id),
  data_prevista date,
  data_efetiva date,
  recorrencia recorrencia_pessoal not null default 'unica',
  situacao situacao_receita_pessoal not null default 'prevista',
  observacoes text,
  cancelada_em timestamptz,
  motivo_cancelamento text,
  criado_em timestamptz not null default now()
);
create index receitas_pessoais_owner_idx on receitas_pessoais(owner_id);
alter table receitas_pessoais enable row level security;
create policy receitas_pessoais_select on receitas_pessoais for select using (owner_id = auth.uid() and is_helysom());
create policy receitas_pessoais_insert on receitas_pessoais for insert with check (owner_id = auth.uid() and is_helysom());
create policy receitas_pessoais_update on receitas_pessoais for update using (owner_id = auth.uid() and is_helysom()) with check (owner_id = auth.uid() and is_helysom());
create policy receitas_pessoais_delete on receitas_pessoais for delete using (owner_id = auth.uid() and is_helysom());

-- Ledger de recebimentos — permite parcial + estorno granular sem apagar o valor original.
create table recebimentos_pessoais (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references profiles(id),
  receita_id uuid not null references receitas_pessoais(id) on delete cascade,
  valor numeric(12,2) not null check (valor > 0),
  data date not null,
  conta_destino_id uuid references contas_pessoais(id),
  criado_em timestamptz not null default now(),
  estornado_em timestamptz,
  estornado_por uuid references profiles(id),
  motivo_estorno text
);
create index recebimentos_pessoais_receita_idx on recebimentos_pessoais(receita_id);
alter table recebimentos_pessoais enable row level security;
create policy recebimentos_pessoais_select on recebimentos_pessoais for select using (owner_id = auth.uid() and is_helysom());
create policy recebimentos_pessoais_insert on recebimentos_pessoais for insert with check (owner_id = auth.uid() and is_helysom());
create policy recebimentos_pessoais_update on recebimentos_pessoais for update using (owner_id = auth.uid() and is_helysom()) with check (owner_id = auth.uid() and is_helysom());

-- ── Despesas pessoais ────────────────────────────────────────────────────────────────────────
-- `cartao_id` entra no Bloco C (ainda não existe tabela de cartão) — por enquanto só conta.
create type situacao_despesa_pessoal as enum ('prevista', 'parcial', 'paga', 'cancelada');

create table despesas_pessoais (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references profiles(id),
  descricao text not null,
  categoria text,
  favorecido text,
  valor_previsto numeric(12,2) not null check (valor_previsto > 0),
  valor_pago numeric(12,2) not null default 0,
  conta_id uuid references contas_pessoais(id),
  vencimento date,
  data_efetiva date,
  recorrencia recorrencia_pessoal not null default 'unica',
  situacao situacao_despesa_pessoal not null default 'prevista',
  observacoes text,
  cancelada_em timestamptz,
  motivo_cancelamento text,
  criado_em timestamptz not null default now()
);
create index despesas_pessoais_owner_idx on despesas_pessoais(owner_id);
alter table despesas_pessoais enable row level security;
create policy despesas_pessoais_select on despesas_pessoais for select using (owner_id = auth.uid() and is_helysom());
create policy despesas_pessoais_insert on despesas_pessoais for insert with check (owner_id = auth.uid() and is_helysom());
create policy despesas_pessoais_update on despesas_pessoais for update using (owner_id = auth.uid() and is_helysom()) with check (owner_id = auth.uid() and is_helysom());
create policy despesas_pessoais_delete on despesas_pessoais for delete using (owner_id = auth.uid() and is_helysom());

-- Ledger de pagamentos — mesmo padrão do ledger de recebimentos.
create table pagamentos_pessoais (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references profiles(id),
  despesa_id uuid not null references despesas_pessoais(id) on delete cascade,
  valor numeric(12,2) not null check (valor > 0),
  data date not null,
  conta_id uuid references contas_pessoais(id),
  criado_em timestamptz not null default now(),
  estornado_em timestamptz,
  estornado_por uuid references profiles(id),
  motivo_estorno text
);
create index pagamentos_pessoais_despesa_idx on pagamentos_pessoais(despesa_id);
alter table pagamentos_pessoais enable row level security;
create policy pagamentos_pessoais_select on pagamentos_pessoais for select using (owner_id = auth.uid() and is_helysom());
create policy pagamentos_pessoais_insert on pagamentos_pessoais for insert with check (owner_id = auth.uid() and is_helysom());
create policy pagamentos_pessoais_update on pagamentos_pessoais for update using (owner_id = auth.uid() and is_helysom()) with check (owner_id = auth.uid() and is_helysom());

-- ── Transferências entre contas próprias ────────────────────────────────────────────────────
-- Nunca é receita nem despesa — é um par vinculado (saída de uma conta = entrada na outra),
-- excluído explicitamente dos cálculos de receitas_pessoais/despesas_pessoais.
create table transferencias_pessoais (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references profiles(id),
  conta_origem_id uuid not null references contas_pessoais(id),
  conta_destino_id uuid not null references contas_pessoais(id),
  valor numeric(12,2) not null check (valor > 0),
  tarifa numeric(12,2) not null default 0,
  data date not null,
  descricao text,
  criado_em timestamptz not null default now(),
  constraint transferencia_contas_distintas check (conta_origem_id <> conta_destino_id)
);
create index transferencias_pessoais_owner_idx on transferencias_pessoais(owner_id);
alter table transferencias_pessoais enable row level security;
create policy transferencias_pessoais_select on transferencias_pessoais for select using (owner_id = auth.uid() and is_helysom());
create policy transferencias_pessoais_insert on transferencias_pessoais for insert with check (owner_id = auth.uid() and is_helysom());
create policy transferencias_pessoais_delete on transferencias_pessoais for delete using (owner_id = auth.uid() and is_helysom());

-- ── Proteção de histórico — mesmo princípio do lado empresarial (migration 0037): não apagar
--    receita/despesa que já teve movimentação real. Cancelar (colunas acima) é a alternativa.
create or replace function bloquear_exclusao_pessoal_com_historico() returns trigger
language plpgsql as $$
begin
  if TG_TABLE_NAME = 'receitas_pessoais' and OLD.valor_recebido > 0 then
    raise exception 'Esta receita já tem recebimento registrado e não pode ser excluída. Cancele em vez de excluir.';
  elsif TG_TABLE_NAME = 'despesas_pessoais' and OLD.valor_pago > 0 then
    raise exception 'Esta despesa já tem pagamento registrado e não pode ser excluída. Cancele em vez de excluir.';
  end if;
  return OLD;
end;
$$;
create trigger receitas_pessoais_bloqueia_exclusao before delete on receitas_pessoais for each row execute function bloquear_exclusao_pessoal_com_historico();
create trigger despesas_pessoais_bloqueia_exclusao before delete on despesas_pessoais for each row execute function bloquear_exclusao_pessoal_com_historico();

-- ── RPCs atômicas de registrar/estornar recebimento e pagamento (mesmo padrão da migration 0037) ──
create or replace function registrar_recebimento_pessoal(p_receita_id uuid, p_valor numeric, p_data date, p_conta_destino_id uuid) returns jsonb
language plpgsql security definer as $$
declare
  v_receita receitas_pessoais%rowtype;
  v_recebido_atual numeric(12,2);
  v_saldo numeric(12,2);
begin
  select * into v_receita from receitas_pessoais where id = p_receita_id for update;
  if not found or v_receita.owner_id <> auth.uid() or not is_helysom() then
    return jsonb_build_object('ok', false, 'reason', 'Receita não encontrada.');
  end if;
  if v_receita.cancelada_em is not null then
    return jsonb_build_object('ok', false, 'reason', 'Receita cancelada não recebe pagamento.');
  end if;

  select coalesce(sum(valor), 0) into v_recebido_atual from recebimentos_pessoais
    where receita_id = p_receita_id and estornado_em is null;
  v_saldo := v_receita.valor_previsto - v_recebido_atual;

  if p_valor <= 0 then return jsonb_build_object('ok', false, 'reason', 'Valor precisa ser maior que zero.'); end if;
  if p_valor > v_saldo then
    return jsonb_build_object('ok', false, 'reason', 'Valor maior que o saldo em aberto.', 'saldo', v_saldo);
  end if;

  insert into recebimentos_pessoais (owner_id, receita_id, valor, data, conta_destino_id)
    values (auth.uid(), p_receita_id, p_valor, p_data, p_conta_destino_id);

  update receitas_pessoais set
    valor_recebido = v_recebido_atual + p_valor,
    data_efetiva = p_data,
    situacao = case when v_recebido_atual + p_valor >= v_receita.valor_previsto then 'recebida' else 'parcial' end
  where id = p_receita_id;

  return jsonb_build_object('ok', true, 'saldoRestante', greatest(0, v_receita.valor_previsto - v_recebido_atual - p_valor));
end;
$$;
grant execute on function registrar_recebimento_pessoal(uuid, numeric, date, uuid) to authenticated;

create or replace function estornar_recebimento_pessoal(p_recebimento_id uuid, p_motivo text) returns jsonb
language plpgsql security definer as $$
declare
  v_rec recebimentos_pessoais%rowtype;
begin
  select * into v_rec from recebimentos_pessoais where id = p_recebimento_id for update;
  if not found or v_rec.owner_id <> auth.uid() or not is_helysom() then
    return jsonb_build_object('ok', false, 'reason', 'Recebimento não encontrado.');
  end if;
  if v_rec.estornado_em is not null then
    return jsonb_build_object('ok', false, 'reason', 'Esse recebimento já foi estornado.');
  end if;

  update recebimentos_pessoais set estornado_em = now(), estornado_por = auth.uid(), motivo_estorno = p_motivo
    where id = p_recebimento_id;

  update receitas_pessoais r set
    valor_recebido = (select coalesce(sum(valor),0) from recebimentos_pessoais where receita_id = r.id and estornado_em is null),
    situacao = case
      when (select coalesce(sum(valor),0) from recebimentos_pessoais where receita_id = r.id and estornado_em is null) = 0 then 'prevista'
      when (select coalesce(sum(valor),0) from recebimentos_pessoais where receita_id = r.id and estornado_em is null) >= r.valor_previsto then 'recebida'
      else 'parcial'
    end
    where r.id = v_rec.receita_id;

  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function estornar_recebimento_pessoal(uuid, text) to authenticated;

create or replace function registrar_pagamento_pessoal(p_despesa_id uuid, p_valor numeric, p_data date, p_conta_id uuid) returns jsonb
language plpgsql security definer as $$
declare
  v_despesa despesas_pessoais%rowtype;
  v_pago_atual numeric(12,2);
  v_saldo numeric(12,2);
begin
  select * into v_despesa from despesas_pessoais where id = p_despesa_id for update;
  if not found or v_despesa.owner_id <> auth.uid() or not is_helysom() then
    return jsonb_build_object('ok', false, 'reason', 'Despesa não encontrada.');
  end if;
  if v_despesa.cancelada_em is not null then
    return jsonb_build_object('ok', false, 'reason', 'Despesa cancelada não recebe pagamento.');
  end if;

  select coalesce(sum(valor), 0) into v_pago_atual from pagamentos_pessoais
    where despesa_id = p_despesa_id and estornado_em is null;
  v_saldo := v_despesa.valor_previsto - v_pago_atual;

  if p_valor <= 0 then return jsonb_build_object('ok', false, 'reason', 'Valor precisa ser maior que zero.'); end if;
  if p_valor > v_saldo then
    return jsonb_build_object('ok', false, 'reason', 'Valor maior que o saldo em aberto.', 'saldo', v_saldo);
  end if;

  insert into pagamentos_pessoais (owner_id, despesa_id, valor, data, conta_id)
    values (auth.uid(), p_despesa_id, p_valor, p_data, p_conta_id);

  update despesas_pessoais set
    valor_pago = v_pago_atual + p_valor,
    data_efetiva = p_data,
    situacao = case when v_pago_atual + p_valor >= v_despesa.valor_previsto then 'paga' else 'parcial' end
  where id = p_despesa_id;

  return jsonb_build_object('ok', true, 'saldoRestante', greatest(0, v_despesa.valor_previsto - v_pago_atual - p_valor));
end;
$$;
grant execute on function registrar_pagamento_pessoal(uuid, numeric, date, uuid) to authenticated;

create or replace function estornar_pagamento_pessoal(p_pagamento_id uuid, p_motivo text) returns jsonb
language plpgsql security definer as $$
declare
  v_pag pagamentos_pessoais%rowtype;
begin
  select * into v_pag from pagamentos_pessoais where id = p_pagamento_id for update;
  if not found or v_pag.owner_id <> auth.uid() or not is_helysom() then
    return jsonb_build_object('ok', false, 'reason', 'Pagamento não encontrado.');
  end if;
  if v_pag.estornado_em is not null then
    return jsonb_build_object('ok', false, 'reason', 'Esse pagamento já foi estornado.');
  end if;

  update pagamentos_pessoais set estornado_em = now(), estornado_por = auth.uid(), motivo_estorno = p_motivo
    where id = p_pagamento_id;

  update despesas_pessoais d set
    valor_pago = (select coalesce(sum(valor),0) from pagamentos_pessoais where despesa_id = d.id and estornado_em is null),
    situacao = case
      when (select coalesce(sum(valor),0) from pagamentos_pessoais where despesa_id = d.id and estornado_em is null) = 0 then 'prevista'
      when (select coalesce(sum(valor),0) from pagamentos_pessoais where despesa_id = d.id and estornado_em is null) >= d.valor_previsto then 'paga'
      else 'parcial'
    end
    where d.id = v_pag.despesa_id;

  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function estornar_pagamento_pessoal(uuid, text) to authenticated;

-- ── Seed: catálogo inicial de origens de receita (só rótulos, nenhum valor/dado real) ────────
-- Rodando pelo SQL Editor a sessão é o papel postgres, não uma sessão autenticada — auth.uid()
-- não funciona aqui. Busca o id direto em auth.users pelo e-mail já confirmado.
insert into origens_receita_pessoal (owner_id, nome)
select u.id, nome
from auth.users u
cross join (values ('Pró-labore I9'), ('Receitas pessoais do digital'), ('Serviços avulsos'), ('Outras receitas')) as t(nome)
where u.email = 'helysomms@gmail.com';

-- Finanças Pessoais — Bloco D: investimentos.
--
-- Mesmo padrão de isolamento dos Blocos A/B/C: owner_id default auth.uid(), RLS exige
-- is_helysom() (migration 0038) E owner_id = auth.uid() em toda operação.
--
-- Regra de negócio central (pedido original): "aporte em investimento não é despesa de
-- consumo, resgate do principal não é receita nova". Por isso os 3 tipos de movimento
-- (aporte/resgate/rendimento) vivem numa tabela própria, nunca em despesas_pessoais/
-- receitas_pessoais — não há risco de um aporte contar como despesa nem de um resgate
-- contar como receita nos indicadores de caixa do Bloco B.
--
-- Saldo do investimento é sempre derivado do ledger de movimentos (mesmo padrão de
-- saldoConta/saldoDivida): aporte + rendimento − resgate, nunca uma coluna mutável.
--
-- `conta_id` num movimento é o dinheiro saindo/voltando de uma conta bancária: aporte tira
-- da conta, resgate devolve pra conta — rendimento fica dentro do investimento (não mexe em
-- conta) a não ser que o próprio Helysom registre depois um resgate do valor. Isso é
-- refletido em `saldoConta` (Bloco B), estendida nesta migração conceitualmente no domain
-- (não no banco) pra também considerar aporte/resgate.

create type tipo_movimento_investimento_pessoal as enum ('aporte', 'resgate', 'rendimento');

create table investimentos_pessoais (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references profiles(id),
  nome text not null,
  tipo text,
  instituicao text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
alter table investimentos_pessoais enable row level security;
create policy investimentos_pessoais_select on investimentos_pessoais for select using (owner_id = auth.uid() and is_helysom());
create policy investimentos_pessoais_insert on investimentos_pessoais for insert with check (owner_id = auth.uid() and is_helysom());
create policy investimentos_pessoais_update on investimentos_pessoais for update using (owner_id = auth.uid() and is_helysom()) with check (owner_id = auth.uid() and is_helysom());
create policy investimentos_pessoais_delete on investimentos_pessoais for delete using (owner_id = auth.uid() and is_helysom());

create table movimentos_investimento_pessoal (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references profiles(id),
  investimento_id uuid not null references investimentos_pessoais(id) on delete cascade,
  tipo tipo_movimento_investimento_pessoal not null,
  valor numeric(12,2) not null check (valor > 0),
  data date not null,
  conta_id uuid references contas_pessoais(id),
  criado_em timestamptz not null default now(),
  estornado_em timestamptz,
  estornado_por uuid references profiles(id),
  motivo_estorno text
);
create index movimentos_investimento_pessoal_investimento_idx on movimentos_investimento_pessoal(investimento_id);
alter table movimentos_investimento_pessoal enable row level security;
create policy movimentos_investimento_pessoal_select on movimentos_investimento_pessoal for select using (owner_id = auth.uid() and is_helysom());
create policy movimentos_investimento_pessoal_insert on movimentos_investimento_pessoal for insert with check (owner_id = auth.uid() and is_helysom());
create policy movimentos_investimento_pessoal_update on movimentos_investimento_pessoal for update using (owner_id = auth.uid() and is_helysom()) with check (owner_id = auth.uid() and is_helysom());

-- ── Proteção de histórico (estende a função já criada nas migrations 0039/0042) ────────────────
create or replace function bloquear_exclusao_pessoal_com_historico() returns trigger
language plpgsql as $$
begin
  if TG_TABLE_NAME = 'receitas_pessoais' then
    if OLD.valor_recebido > 0 then
      raise exception 'Esta receita já tem recebimento registrado e não pode ser excluída. Cancele em vez de excluir.';
    end if;
  elsif TG_TABLE_NAME = 'despesas_pessoais' then
    if OLD.valor_pago > 0 then
      raise exception 'Esta despesa já tem pagamento registrado e não pode ser excluída. Cancele em vez de excluir.';
    end if;
  elsif TG_TABLE_NAME = 'cartoes_pessoais' then
    if exists (select 1 from compras_cartao_pessoal where cartao_id = OLD.id) then
      raise exception 'Este cartão já tem compras registradas e não pode ser excluído. Desative em vez de excluir.';
    end if;
  elsif TG_TABLE_NAME = 'dividas_pessoais' then
    if exists (select 1 from pagamentos_divida_pessoal where divida_id = OLD.id and estornado_em is null) then
      raise exception 'Esta dívida já tem pagamento registrado e não pode ser excluída.';
    end if;
  elsif TG_TABLE_NAME = 'investimentos_pessoais' then
    if exists (select 1 from movimentos_investimento_pessoal where investimento_id = OLD.id) then
      raise exception 'Este investimento já tem movimentação registrada e não pode ser excluído. Desative em vez de excluir.';
    end if;
  end if;
  return OLD;
end;
$$;
create trigger investimentos_pessoais_bloqueia_exclusao before delete on investimentos_pessoais for each row execute function bloquear_exclusao_pessoal_com_historico();

-- ── RPCs atômicas de registrar/estornar movimento (mesmo padrão das migrations 0039/0042) ─────
create or replace function registrar_movimento_investimento_pessoal(
  p_investimento_id uuid, p_tipo tipo_movimento_investimento_pessoal, p_valor numeric, p_data date, p_conta_id uuid
) returns jsonb
language plpgsql security definer as $$
declare
  v_investimento investimentos_pessoais%rowtype;
  v_saldo numeric(12,2);
begin
  select * into v_investimento from investimentos_pessoais where id = p_investimento_id for update;
  if not found or v_investimento.owner_id <> auth.uid() or not is_helysom() then
    return jsonb_build_object('ok', false, 'reason', 'Investimento não encontrado.');
  end if;
  if p_valor <= 0 then return jsonb_build_object('ok', false, 'reason', 'Valor precisa ser maior que zero.'); end if;

  if p_tipo = 'resgate' then
    select coalesce(sum(case when tipo = 'resgate' then -valor else valor end), 0) into v_saldo
      from movimentos_investimento_pessoal
      where investimento_id = p_investimento_id and estornado_em is null;
    if p_valor > v_saldo then
      return jsonb_build_object('ok', false, 'reason', 'Valor maior que o saldo investido.', 'saldo', v_saldo);
    end if;
  end if;

  insert into movimentos_investimento_pessoal (owner_id, investimento_id, tipo, valor, data, conta_id)
    values (auth.uid(), p_investimento_id, p_tipo, p_valor, p_data, p_conta_id);

  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function registrar_movimento_investimento_pessoal(uuid, tipo_movimento_investimento_pessoal, numeric, date, uuid) to authenticated;

create or replace function estornar_movimento_investimento_pessoal(p_movimento_id uuid, p_motivo text) returns jsonb
language plpgsql security definer as $$
declare
  v_mov movimentos_investimento_pessoal%rowtype;
begin
  select * into v_mov from movimentos_investimento_pessoal where id = p_movimento_id for update;
  if not found or v_mov.owner_id <> auth.uid() or not is_helysom() then
    return jsonb_build_object('ok', false, 'reason', 'Movimento não encontrado.');
  end if;
  if v_mov.estornado_em is not null then
    return jsonb_build_object('ok', false, 'reason', 'Esse movimento já foi estornado.');
  end if;

  update movimentos_investimento_pessoal set estornado_em = now(), estornado_por = auth.uid(), motivo_estorno = p_motivo
    where id = p_movimento_id;

  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function estornar_movimento_investimento_pessoal(uuid, text) to authenticated;

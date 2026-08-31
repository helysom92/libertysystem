-- Finanças Pessoais — Bloco C: cartões de crédito (compras/faturas) e dívidas.
--
-- Mesmo padrão de isolamento dos Blocos A/B: owner_id default auth.uid(), RLS exige
-- is_helysom() (migration 0038) E owner_id = auth.uid() em toda operação.
--
-- Regra de negócio central (pedido original): "compra no cartão gera compromisso, pagamento
-- da fatura gera a baixa — nunca contar como duas despesas". Por isso a compra em si NUNCA é
-- uma despesa — só um registro de compromisso (`compras_cartao_pessoal`). O pagamento da
-- fatura consolidada de um cartão num mês é lançado como uma `despesas_pessoais` normal
-- (ganhando `cartao_id`/`fatura_ano`/`fatura_mes`), reaproveitando 100% do ledger de pagamento/
-- estorno que já existe (migration 0039) — nenhuma RPC nova pro lado do pagamento.
--
-- Dívida segue "não precisa reconstruir o passado inteiro (só saldo atual + parcelas
-- restantes)": `saldo_inicial` é o saldo devedor no momento do CADASTRO (não o valor original
-- do empréstimo), e o saldo atual é sempre derivado por ledger (mesmo padrão de
-- `saldoConta`/`contas_pessoais.saldo_inicial` do Bloco B), nunca uma coluna mutável recalculada
-- na mão.

-- ── Cartões ──────────────────────────────────────────────────────────────────────────────────
create table cartoes_pessoais (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references profiles(id),
  nome text not null,
  banco text,
  dia_fechamento int not null check (dia_fechamento between 1 and 28),
  dia_vencimento int not null check (dia_vencimento between 1 and 28),
  limite numeric(12,2),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
alter table cartoes_pessoais enable row level security;
create policy cartoes_pessoais_select on cartoes_pessoais for select using (owner_id = auth.uid() and is_helysom());
create policy cartoes_pessoais_insert on cartoes_pessoais for insert with check (owner_id = auth.uid() and is_helysom());
create policy cartoes_pessoais_update on cartoes_pessoais for update using (owner_id = auth.uid() and is_helysom()) with check (owner_id = auth.uid() and is_helysom());
create policy cartoes_pessoais_delete on cartoes_pessoais for delete using (owner_id = auth.uid() and is_helysom());

-- ── Compras no cartão — uma linha por parcela (mesmo padrão de servico_parcelas) ───────────────
create table compras_cartao_pessoal (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references profiles(id),
  cartao_id uuid not null references cartoes_pessoais(id),
  compra_grupo_id uuid not null default gen_random_uuid(),
  descricao text not null,
  categoria text,
  valor_parcela numeric(12,2) not null check (valor_parcela > 0),
  numero_parcela int not null default 1,
  parcelas_total int not null default 1,
  data_compra date not null,
  fatura_ano int not null,
  fatura_mes int not null check (fatura_mes between 1 and 12),
  criado_em timestamptz not null default now(),
  cancelada_em timestamptz,
  cancelada_por uuid references profiles(id),
  motivo_cancelamento text
);
create index compras_cartao_pessoal_fatura_idx on compras_cartao_pessoal(cartao_id, fatura_ano, fatura_mes);
create index compras_cartao_pessoal_grupo_idx on compras_cartao_pessoal(compra_grupo_id);
alter table compras_cartao_pessoal enable row level security;
create policy compras_cartao_pessoal_select on compras_cartao_pessoal for select using (owner_id = auth.uid() and is_helysom());
create policy compras_cartao_pessoal_insert on compras_cartao_pessoal for insert with check (owner_id = auth.uid() and is_helysom());
create policy compras_cartao_pessoal_update on compras_cartao_pessoal for update using (owner_id = auth.uid() and is_helysom()) with check (owner_id = auth.uid() and is_helysom());
create policy compras_cartao_pessoal_delete on compras_cartao_pessoal for delete using (owner_id = auth.uid() and is_helysom());

-- ── Liga o pagamento da fatura a uma despesa normal (Bloco B) — nunca uma segunda despesa ─────
alter table despesas_pessoais add column cartao_id uuid references cartoes_pessoais(id);
alter table despesas_pessoais add column fatura_ano int;
alter table despesas_pessoais add column fatura_mes int check (fatura_mes is null or fatura_mes between 1 and 12);

-- ── Dívidas ──────────────────────────────────────────────────────────────────────────────────
create type situacao_divida_pessoal as enum ('ativa', 'quitada');

create table dividas_pessoais (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references profiles(id),
  credor text not null,
  descricao text,
  saldo_inicial numeric(12,2) not null check (saldo_inicial > 0),
  valor_parcela numeric(12,2),
  parcelas_restantes_inicial int,
  dia_vencimento int check (dia_vencimento is null or dia_vencimento between 1 and 28),
  taxa_juros_mensal numeric(6,3),
  situacao situacao_divida_pessoal not null default 'ativa',
  observacoes text,
  quitada_em timestamptz,
  criado_em timestamptz not null default now()
);
create index dividas_pessoais_owner_idx on dividas_pessoais(owner_id);
alter table dividas_pessoais enable row level security;
create policy dividas_pessoais_select on dividas_pessoais for select using (owner_id = auth.uid() and is_helysom());
create policy dividas_pessoais_insert on dividas_pessoais for insert with check (owner_id = auth.uid() and is_helysom());
create policy dividas_pessoais_update on dividas_pessoais for update using (owner_id = auth.uid() and is_helysom()) with check (owner_id = auth.uid() and is_helysom());
create policy dividas_pessoais_delete on dividas_pessoais for delete using (owner_id = auth.uid() and is_helysom());

-- Ledger de pagamentos — mesmo padrão dos ledgers do Bloco B.
create table pagamentos_divida_pessoal (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references profiles(id),
  divida_id uuid not null references dividas_pessoais(id) on delete cascade,
  valor numeric(12,2) not null check (valor > 0),
  data date not null,
  conta_id uuid references contas_pessoais(id),
  criado_em timestamptz not null default now(),
  estornado_em timestamptz,
  estornado_por uuid references profiles(id),
  motivo_estorno text
);
create index pagamentos_divida_pessoal_divida_idx on pagamentos_divida_pessoal(divida_id);
alter table pagamentos_divida_pessoal enable row level security;
create policy pagamentos_divida_pessoal_select on pagamentos_divida_pessoal for select using (owner_id = auth.uid() and is_helysom());
create policy pagamentos_divida_pessoal_insert on pagamentos_divida_pessoal for insert with check (owner_id = auth.uid() and is_helysom());
create policy pagamentos_divida_pessoal_update on pagamentos_divida_pessoal for update using (owner_id = auth.uid() and is_helysom()) with check (owner_id = auth.uid() and is_helysom());

-- ── Proteção de histórico (estende a função já criada na migration 0039) ──────────────────────
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
  end if;
  return OLD;
end;
$$;
create trigger cartoes_pessoais_bloqueia_exclusao before delete on cartoes_pessoais for each row execute function bloquear_exclusao_pessoal_com_historico();
create trigger dividas_pessoais_bloqueia_exclusao before delete on dividas_pessoais for each row execute function bloquear_exclusao_pessoal_com_historico();

-- ── RPCs atômicas de registrar/estornar pagamento de dívida (mesmo padrão da migration 0039) ──
create or replace function registrar_pagamento_divida_pessoal(p_divida_id uuid, p_valor numeric, p_data date, p_conta_id uuid) returns jsonb
language plpgsql security definer as $$
declare
  v_divida dividas_pessoais%rowtype;
  v_pago_atual numeric(12,2);
  v_saldo numeric(12,2);
begin
  select * into v_divida from dividas_pessoais where id = p_divida_id for update;
  if not found or v_divida.owner_id <> auth.uid() or not is_helysom() then
    return jsonb_build_object('ok', false, 'reason', 'Dívida não encontrada.');
  end if;
  if v_divida.situacao = 'quitada' then
    return jsonb_build_object('ok', false, 'reason', 'Esta dívida já está quitada.');
  end if;

  select coalesce(sum(valor), 0) into v_pago_atual from pagamentos_divida_pessoal
    where divida_id = p_divida_id and estornado_em is null;
  v_saldo := v_divida.saldo_inicial - v_pago_atual;

  if p_valor <= 0 then return jsonb_build_object('ok', false, 'reason', 'Valor precisa ser maior que zero.'); end if;
  if p_valor > v_saldo then
    return jsonb_build_object('ok', false, 'reason', 'Valor maior que o saldo devedor.', 'saldo', v_saldo);
  end if;

  insert into pagamentos_divida_pessoal (owner_id, divida_id, valor, data, conta_id)
    values (auth.uid(), p_divida_id, p_valor, p_data, p_conta_id);

  update dividas_pessoais set
    situacao = case when v_pago_atual + p_valor >= v_divida.saldo_inicial then 'quitada' else 'ativa' end,
    quitada_em = case when v_pago_atual + p_valor >= v_divida.saldo_inicial then now() else null end,
    parcelas_restantes_inicial = case
      when parcelas_restantes_inicial is not null and parcelas_restantes_inicial > 0 then parcelas_restantes_inicial - 1
      else parcelas_restantes_inicial
    end
  where id = p_divida_id;

  return jsonb_build_object('ok', true, 'saldoRestante', greatest(0, v_divida.saldo_inicial - v_pago_atual - p_valor));
end;
$$;
grant execute on function registrar_pagamento_divida_pessoal(uuid, numeric, date, uuid) to authenticated;

create or replace function estornar_pagamento_divida_pessoal(p_pagamento_id uuid, p_motivo text) returns jsonb
language plpgsql security definer as $$
declare
  v_pag pagamentos_divida_pessoal%rowtype;
  v_divida dividas_pessoais%rowtype;
  v_pago_apos numeric(12,2);
begin
  select * into v_pag from pagamentos_divida_pessoal where id = p_pagamento_id for update;
  if not found or v_pag.owner_id <> auth.uid() or not is_helysom() then
    return jsonb_build_object('ok', false, 'reason', 'Pagamento não encontrado.');
  end if;
  if v_pag.estornado_em is not null then
    return jsonb_build_object('ok', false, 'reason', 'Esse pagamento já foi estornado.');
  end if;

  update pagamentos_divida_pessoal set estornado_em = now(), estornado_por = auth.uid(), motivo_estorno = p_motivo
    where id = p_pagamento_id;

  select * into v_divida from dividas_pessoais where id = v_pag.divida_id;
  select coalesce(sum(valor), 0) into v_pago_apos from pagamentos_divida_pessoal
    where divida_id = v_pag.divida_id and estornado_em is null;

  update dividas_pessoais set
    situacao = case when v_pago_apos >= saldo_inicial then 'quitada' else 'ativa' end,
    quitada_em = case when v_pago_apos >= saldo_inicial then quitada_em else null end,
    parcelas_restantes_inicial = case
      when parcelas_restantes_inicial is not null then parcelas_restantes_inicial + 1
      else parcelas_restantes_inicial
    end
  where id = v_pag.divida_id;

  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function estornar_pagamento_divida_pessoal(uuid, text) to authenticated;

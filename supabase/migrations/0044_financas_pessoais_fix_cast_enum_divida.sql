-- Corrige as RPCs de dívida (migration 0043): `case when ... then 'quitada' else 'ativa' end`
-- sem cast explícito resolve como `text`, não como `situacao_divida_pessoal` — Postgres recusa
-- a atribuição em runtime ("column situacao is of type situacao_divida_pessoal but expression
-- is of type text"). Mesmo bug já visto e corrigido nas RPCs pessoais de receita/despesa
-- (migration 0040) — aqui é a mesma classe de erro, só que na RPC de dívida (Bloco D), que não
-- existia ainda naquela migration.

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
    situacao = case when v_pago_atual + p_valor >= v_divida.saldo_inicial then 'quitada'::situacao_divida_pessoal else 'ativa'::situacao_divida_pessoal end,
    quitada_em = case when v_pago_atual + p_valor >= v_divida.saldo_inicial then now() else null end,
    parcelas_restantes_inicial = case
      when parcelas_restantes_inicial is not null and parcelas_restantes_inicial > 0 then parcelas_restantes_inicial - 1
      else parcelas_restantes_inicial
    end
  where id = p_divida_id;

  return jsonb_build_object('ok', true, 'saldoRestante', greatest(0, v_divida.saldo_inicial - v_pago_atual - p_valor));
end;
$$;

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
    situacao = case when v_pago_apos >= saldo_inicial then 'quitada'::situacao_divida_pessoal else 'ativa'::situacao_divida_pessoal end,
    quitada_em = case when v_pago_apos >= saldo_inicial then quitada_em else null end,
    parcelas_restantes_inicial = case
      when parcelas_restantes_inicial is not null then parcelas_restantes_inicial + 1
      else parcelas_restantes_inicial
    end
  where id = v_pag.divida_id;

  return jsonb_build_object('ok', true);
end;
$$;

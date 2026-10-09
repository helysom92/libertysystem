-- Correção: registrar_recebimento_parcela calculava "quanto já foi pago" só pelo histórico
-- (parcela_recebimentos). Parcelas com valor_pago registrado ANTES do histórico existir (ou fora
-- dele) pareciam ter R$ 0 pago: o recebimento novo sobrescrevia servico_parcelas.valor_pago e
-- reescrevia o lançamento vinculado (perdendo o que já tinha entrado).
-- Agora o já-pago é o MAIOR entre o histórico e o valor_pago da parcela; se já há pagamento, o
-- recebimento novo vira um lançamento de complemento — nunca mexe no lançamento existente.
-- Resto da função idêntico ao da migration 0050.

create or replace function registrar_recebimento_parcela(
  p_parcela_id uuid, p_valor numeric, p_data date, p_forma_pagamento text
) returns jsonb
language plpgsql security definer as $$
declare
  v_parcela servico_parcelas%rowtype;
  v_pago_atual numeric(12, 2);
  v_saldo numeric(12, 2);
  v_lancamento_id uuid;
  v_servico servicos%rowtype;
begin
  if not is_admin_or_secretaria() then
    return jsonb_build_object('ok', false, 'reason', 'Apenas Administrador ou Secretaria pode registrar recebimento.');
  end if;

  select * into v_parcela from servico_parcelas where id = p_parcela_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'Parcela não encontrada.');
  end if;
  if v_parcela.cancelada_em is not null then
    return jsonb_build_object('ok', false, 'reason', 'Essa parcela está cancelada e não pode receber pagamento.');
  end if;

  select greatest(
           coalesce(sum(valor), 0),
           coalesce(v_parcela.valor_pago, 0)
         ) into v_pago_atual
    from parcela_recebimentos where parcela_id = p_parcela_id and estornado_em is null;
  v_saldo := v_parcela.valor_previsto - v_pago_atual;

  if p_valor is null or p_valor <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'O valor recebido precisa ser maior que zero.');
  end if;
  if p_valor > v_saldo then
    return jsonb_build_object('ok', false, 'reason', 'O valor informado é maior que o saldo em aberto dessa parcela.', 'saldo', v_saldo);
  end if;

  select * into v_servico from servicos where id = v_parcela.servico_id;

  if v_pago_atual = 0 and v_parcela.lancamento_id is not null then
    update lancamentos
    set valor = p_valor, data = p_data, forma_pagamento = p_forma_pagamento, status = 'realizado'
    where id = v_parcela.lancamento_id;
    v_lancamento_id := v_parcela.lancamento_id;
  else
    insert into lancamentos (tipo, descricao, categoria, valor, data, servico_id, forma_pagamento, status)
    values (
      'Receita',
      v_servico.cliente || ' — ' || v_parcela.descricao || (case when v_pago_atual > 0 then ' (complemento)' else '' end),
      'Recebimento de serviço', p_valor, p_data, v_parcela.servico_id, p_forma_pagamento, 'realizado'
    )
    returning id into v_lancamento_id;
  end if;

  insert into parcela_recebimentos (parcela_id, lancamento_id, valor, data, forma_pagamento, usuario_id)
  values (p_parcela_id, v_lancamento_id, p_valor, p_data, p_forma_pagamento, auth.uid());

  update servico_parcelas
  set valor_pago = v_pago_atual + p_valor,
      pago_em = now(),
      forma_pagamento = p_forma_pagamento,
      lancamento_id = coalesce(v_parcela.lancamento_id, v_lancamento_id)
  where id = p_parcela_id;

  insert into financeiro_eventos (entidade, entidade_id, evento, valor_anterior, valor_novo, usuario_id)
  values (
    'parcela', p_parcela_id,
    case when v_pago_atual + p_valor >= v_parcela.valor_previsto then 'pagamento_total' else 'pagamento_parcial' end,
    v_pago_atual, v_pago_atual + p_valor, auth.uid()
  );

  return jsonb_build_object('ok', true, 'saldoRestante', greatest(0, v_parcela.valor_previsto - v_pago_atual - p_valor));
end;
$$;

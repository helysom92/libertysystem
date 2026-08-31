-- Finanças Pessoais — corrige bug real encontrado em teste manual (2026-08-31): as 4 RPCs de
-- registrar/estornar recebimento e pagamento (migration 0039) atualizam a coluna `situacao`
-- (tipo enum) a partir de uma expressão `case when ... then 'texto' else 'texto' end` — como os
-- dois ramos são literais de texto puro (sem nenhum operando já tipado como enum no meio), o
-- Postgres resolve o tipo do CASE inteiro como `text`, não como o enum, e a atribuição
-- `situacao = <expressão text>` falha em tempo de execução ("column is of type ... but
-- expression is of type text"). Corrige adicionando cast explícito (`::situacao_receita_pessoal`
-- / `::situacao_despesa_pessoal`) em cada ramo do CASE — mesma lógica das funções, só o tipo
-- da expressão que estava errado. `create or replace function` com a mesma assinatura, sem
-- precisar dropar nada.

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
    situacao = case when v_recebido_atual + p_valor >= v_receita.valor_previsto
      then 'recebida'::situacao_receita_pessoal else 'parcial'::situacao_receita_pessoal end
  where id = p_receita_id;

  return jsonb_build_object('ok', true, 'saldoRestante', greatest(0, v_receita.valor_previsto - v_recebido_atual - p_valor));
end;
$$;

create or replace function estornar_recebimento_pessoal(p_recebimento_id uuid, p_motivo text) returns jsonb
language plpgsql security definer as $$
declare
  v_rec recebimentos_pessoais%rowtype;
  v_recebido_pos_estorno numeric(12,2);
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

  select coalesce(sum(valor),0) into v_recebido_pos_estorno from recebimentos_pessoais
    where receita_id = v_rec.receita_id and estornado_em is null;

  update receitas_pessoais r set
    valor_recebido = v_recebido_pos_estorno,
    situacao = case
      when v_recebido_pos_estorno = 0 then 'prevista'::situacao_receita_pessoal
      when v_recebido_pos_estorno >= r.valor_previsto then 'recebida'::situacao_receita_pessoal
      else 'parcial'::situacao_receita_pessoal
    end
    where r.id = v_rec.receita_id;

  return jsonb_build_object('ok', true);
end;
$$;

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
    situacao = case when v_pago_atual + p_valor >= v_despesa.valor_previsto
      then 'paga'::situacao_despesa_pessoal else 'parcial'::situacao_despesa_pessoal end
  where id = p_despesa_id;

  return jsonb_build_object('ok', true, 'saldoRestante', greatest(0, v_despesa.valor_previsto - v_pago_atual - p_valor));
end;
$$;

create or replace function estornar_pagamento_pessoal(p_pagamento_id uuid, p_motivo text) returns jsonb
language plpgsql security definer as $$
declare
  v_pag pagamentos_pessoais%rowtype;
  v_pago_pos_estorno numeric(12,2);
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

  select coalesce(sum(valor),0) into v_pago_pos_estorno from pagamentos_pessoais
    where despesa_id = v_pag.despesa_id and estornado_em is null;

  update despesas_pessoais d set
    valor_pago = v_pago_pos_estorno,
    situacao = case
      when v_pago_pos_estorno = 0 then 'prevista'::situacao_despesa_pessoal
      when v_pago_pos_estorno >= d.valor_previsto then 'paga'::situacao_despesa_pessoal
      else 'parcial'::situacao_despesa_pessoal
    end
    where d.id = v_pag.despesa_id;

  return jsonb_build_object('ok', true);
end;
$$;

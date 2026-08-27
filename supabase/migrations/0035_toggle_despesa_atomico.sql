-- Etapa 2 — corrige uma corrida real: hoje "marcar despesa recorrente como paga" faz um
-- select e depois um insert em chamadas JS separadas — 2 cliques rápidos (ou uma rede lenta)
-- passam os dois pela checagem antes de qualquer um escrever, criando 2 lançamentos (um fica
-- órfão). Aqui o mesmo miolo vira 2 funções Postgres, atômicas por natureza (uma transação
-- por chamada, com a linha da ocorrência travada por `for update` durante toda a operação).
--
-- Não apaga tabela nem dado nenhum — só adiciona 2 funções novas.

create or replace function toggle_despesa_fixa_ocorrencia(
  p_despesa_fixa_id uuid, p_ano int, p_mes int, p_pago boolean
) returns jsonb
language plpgsql security definer as $$
declare
  v_lancamento_id uuid;
  v_despesa despesas_fixas%rowtype;
  v_dias_no_mes int;
  v_dia int;
  v_data date;
begin
  insert into despesas_fixas_ocorrencias (despesa_fixa_id, ano, mes, pago)
  values (p_despesa_fixa_id, p_ano, p_mes, false)
  on conflict (despesa_fixa_id, ano, mes) do nothing;

  select lancamento_id into v_lancamento_id
  from despesas_fixas_ocorrencias
  where despesa_fixa_id = p_despesa_fixa_id and ano = p_ano and mes = p_mes
  for update;

  if p_pago then
    select * into v_despesa from despesas_fixas where id = p_despesa_fixa_id;
    if not found then
      raise exception 'Despesa fixa não encontrada.';
    end if;

    if v_lancamento_id is not null then
      update lancamentos set status = 'realizado' where id = v_lancamento_id;
    else
      v_dias_no_mes := extract(day from (date_trunc('month', make_date(p_ano, p_mes, 1)) + interval '1 month - 1 day'));
      v_dia := least(v_despesa.dia_vencimento, v_dias_no_mes);
      v_data := make_date(p_ano, p_mes, v_dia);
      insert into lancamentos (tipo, descricao, categoria, valor, data, fornecedor_id, status)
      values ('Despesa', v_despesa.descricao, v_despesa.categoria, v_despesa.valor, v_data, v_despesa.fornecedor_id, 'realizado')
      returning id into v_lancamento_id;
    end if;
  elsif v_lancamento_id is not null then
    delete from lancamentos where id = v_lancamento_id;
    v_lancamento_id := null;
  end if;

  update despesas_fixas_ocorrencias
  set pago = p_pago, pago_em = case when p_pago then now() else null end, lancamento_id = v_lancamento_id
  where despesa_fixa_id = p_despesa_fixa_id and ano = p_ano and mes = p_mes;

  return jsonb_build_object('ok', true, 'lancamento_id', v_lancamento_id);
end;
$$;

create or replace function toggle_despesa_variavel_ocorrencia(
  p_despesa_variavel_id uuid, p_ano int, p_mes int, p_pago boolean
) returns jsonb
language plpgsql security definer as $$
declare
  v_lancamento_id uuid;
  v_valor_real numeric(12,2);
  v_despesa despesas_variaveis%rowtype;
  v_valor numeric(12,2);
  v_data date;
begin
  insert into despesas_variaveis_ocorrencias (despesa_variavel_id, ano, mes, pago)
  values (p_despesa_variavel_id, p_ano, p_mes, false)
  on conflict (despesa_variavel_id, ano, mes) do nothing;

  select lancamento_id, valor_real into v_lancamento_id, v_valor_real
  from despesas_variaveis_ocorrencias
  where despesa_variavel_id = p_despesa_variavel_id and ano = p_ano and mes = p_mes
  for update;

  if p_pago then
    select * into v_despesa from despesas_variaveis where id = p_despesa_variavel_id;
    if not found then
      raise exception 'Despesa variável não encontrada.';
    end if;
    v_valor := coalesce(v_valor_real, v_despesa.valor_provisionado);
    v_data := coalesce(v_despesa.data, make_date(p_ano, p_mes, 1));

    if v_lancamento_id is not null then
      update lancamentos set status = 'realizado', valor = v_valor where id = v_lancamento_id;
    else
      insert into lancamentos (tipo, descricao, categoria, valor, data, fornecedor_id, status)
      values ('Despesa', v_despesa.descricao, v_despesa.categoria, v_valor, v_data, v_despesa.fornecedor_id, 'realizado')
      returning id into v_lancamento_id;
    end if;
  elsif v_lancamento_id is not null then
    delete from lancamentos where id = v_lancamento_id;
    v_lancamento_id := null;
  end if;

  update despesas_variaveis_ocorrencias
  set pago = p_pago, pago_em = case when p_pago then now() else null end, lancamento_id = v_lancamento_id
  where despesa_variavel_id = p_despesa_variavel_id and ano = p_ano and mes = p_mes;

  return jsonb_build_object('ok', true, 'lancamento_id', v_lancamento_id);
end;
$$;

grant execute on function toggle_despesa_fixa_ocorrencia(uuid, int, int, boolean) to authenticated;
grant execute on function toggle_despesa_variavel_ocorrencia(uuid, int, int, boolean) to authenticated;

-- Etapa 4A.1/4A.3 (continuação) — a migration 0046 já fechou o buraco de EXECUTE-pra-PUBLIC
-- (RPC chamável por visitante 100% anônimo). Mas dentro do universo de usuários já
-- autenticados, essas RPCs financeiras/comerciais ainda não validavam papel NENHUM por dentro
-- de si mesmas — só dependiam da Server Action (`requireRole`) do lado do Next.js, que não
-- protege contra uma chamada direta à API REST do Supabase usando a sessão de um usuário de
-- Produção já logado (só precisa do token JWT dele, sem nenhum exploit, só pular a UI).
--
-- Ou seja: hoje, um usuário `role='producao'` autenticado consegue, chamando a RPC direto:
--   - aprovar um orçamento (aprova_orcamento) e cancelar um serviço (cancelar_servico);
--   - registrar/estornar recebimento de parcela (valores, formas de pagamento);
--   - marcar/desmarcar despesa fixa ou variável como paga, registrar/estornar pagamento
--     parcial de despesa;
--   - gerar/reenviar o link público de proposta comercial (ensure_share_token).
--
-- Nenhuma dessas é uma ação operacional de Produção — todas são comerciais/financeiras,
-- reservadas a Administrador/Secretaria em todo o resto do sistema. `move_card_para_coluna`
-- continua SEM essa checagem — é intencional, os 3 papéis podem mover card (spec original).
-- `get_servico_producao`/`listar_servicos_producao` também continuam sem checagem — já
-- devolvem só dado seguro/operacional, não fazem sentido travar por papel.
--
-- Correção: cada função abaixo é reescrita (create or replace, corpo idêntico ao que já existe
-- hoje em produção — só a checagem de papel foi inserida logo no início) pra recusar a chamada
-- quando quem chama não é administrador nem secretaria, usando o helper já existente
-- `is_admin_or_secretaria()` (mesmo usado nas policies de RLS — lê o papel de
-- auth.uid() -> profiles, stable, seguro pra chamar de dentro de outra função).

create or replace function aprova_orcamento(p_servico_id uuid) returns jsonb
language plpgsql security definer as $$
declare
  sv servicos%rowtype;
  destino colunas%rowtype;
  novo_numero text;
begin
  if not is_admin_or_secretaria() then
    return jsonb_build_object('ok', false, 'reason', 'Apenas Administrador ou Secretaria pode aprovar um orçamento.');
  end if;

  select * into sv from servicos where id = p_servico_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'Serviço não encontrado.');
  end if;
  if sv.numero is not null then
    return jsonb_build_object('ok', false, 'reason', 'Já é uma Ordem de Serviço.');
  end if;

  select * into destino from colunas where board = 'os' order by ordem limit 1;
  novo_numero := 'OS-' || nextval('servico_numero_seq');

  update servicos set
    numero = novo_numero,
    coluna_id = destino.id,
    estagio = destino.label,
    aprovado_em = now()
  where id = p_servico_id;

  insert into checklist_items (servico_id, texto, ordem)
  select p_servico_id, texto, ordem
  from (values
    ('Conferir medidas', 0), ('Preparar arte/arquivo final', 1), ('Separar materiais', 2),
    ('Produção', 3), ('Instalação/Entrega', 4), ('Conferência final', 5)
  ) as t(texto, ordem);

  insert into historico_entries (servico_id, texto)
    values (p_servico_id, 'Orçamento aprovado — numeração ' || novo_numero || ' atribuída');

  return jsonb_build_object('ok', true, 'numero', novo_numero);
end;
$$;

create or replace function cancelar_servico(p_servico_id uuid, p_motivo text) returns jsonb
language plpgsql security definer as $$
begin
  if not is_admin_or_secretaria() then
    return jsonb_build_object('ok', false, 'reason', 'Apenas Administrador ou Secretaria pode cancelar um serviço.');
  end if;
  if not exists (select 1 from servicos where id = p_servico_id) then
    return jsonb_build_object('ok', false, 'reason', 'Serviço não encontrado.');
  end if;
  update servicos set financeiro_status = 'Cancelado' where id = p_servico_id;
  insert into financeiro_eventos (entidade, entidade_id, evento, motivo, usuario_id)
  values ('servico', p_servico_id, 'cancelamento', p_motivo, auth.uid());
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function ensure_share_token(p_servico_id uuid) returns uuid
language plpgsql security definer as $$
declare
  v_token uuid;
begin
  if not is_admin_or_secretaria() then
    raise exception 'Apenas Administrador ou Secretaria pode gerar o link de proposta.';
  end if;
  select share_token into v_token from servicos where id = p_servico_id;
  if v_token is null then
    v_token := gen_random_uuid();
    update servicos set share_token = v_token where id = p_servico_id;
  end if;
  return v_token;
end;
$$;

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

  select coalesce(sum(valor), 0) into v_pago_atual
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

create or replace function estornar_recebimento_parcela(p_recebimento_id uuid, p_motivo text) returns jsonb
language plpgsql security definer as $$
declare
  v_rec parcela_recebimentos%rowtype;
begin
  if not is_admin_or_secretaria() then
    return jsonb_build_object('ok', false, 'reason', 'Apenas Administrador ou Secretaria pode estornar recebimento.');
  end if;

  select * into v_rec from parcela_recebimentos where id = p_recebimento_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'Recebimento não encontrado.');
  end if;
  if v_rec.estornado_em is not null then
    return jsonb_build_object('ok', false, 'reason', 'Esse recebimento já foi estornado.');
  end if;

  update parcela_recebimentos
  set estornado_em = now(), estornado_por = auth.uid(), motivo_estorno = p_motivo
  where id = p_recebimento_id;

  if v_rec.lancamento_id is not null then
    update lancamentos set status = 'cancelado' where id = v_rec.lancamento_id;
  end if;

  update servico_parcelas sp
  set valor_pago = (
    select coalesce(sum(valor), 0) from parcela_recebimentos where parcela_id = sp.id and estornado_em is null
  )
  where sp.id = v_rec.parcela_id;

  insert into financeiro_eventos (entidade, entidade_id, evento, valor_anterior, valor_novo, motivo, usuario_id)
  values ('parcela_recebimento', p_recebimento_id, 'estorno', v_rec.valor, 0, p_motivo, auth.uid());

  return jsonb_build_object('ok', true);
end;
$$;

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
  if not is_admin_or_secretaria() then
    return jsonb_build_object('ok', false, 'reason', 'Apenas Administrador ou Secretaria pode alterar despesa fixa.');
  end if;

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
  if not is_admin_or_secretaria() then
    return jsonb_build_object('ok', false, 'reason', 'Apenas Administrador ou Secretaria pode alterar despesa variável.');
  end if;

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

create or replace function registrar_pagamento_despesa_fixa_ocorrencia(
  p_despesa_fixa_id uuid, p_ano int, p_mes int, p_valor numeric, p_data date
) returns jsonb
language plpgsql security definer as $$
declare
  v_despesa despesas_fixas%rowtype;
  v_ocorrencia_id uuid;
  v_pago_atual numeric(12, 2);
  v_esperado numeric(12, 2);
  v_saldo numeric(12, 2);
  v_lancamento_id uuid;
  v_atual despesas_fixas_ocorrencias%rowtype;
begin
  if not is_admin_or_secretaria() then
    return jsonb_build_object('ok', false, 'reason', 'Apenas Administrador ou Secretaria pode registrar pagamento de despesa.');
  end if;

  select * into v_despesa from despesas_fixas where id = p_despesa_fixa_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'Despesa fixa não encontrada.'); end if;

  insert into despesas_fixas_ocorrencias (despesa_fixa_id, ano, mes, pago)
  values (p_despesa_fixa_id, p_ano, p_mes, false)
  on conflict (despesa_fixa_id, ano, mes) do nothing;

  select * into v_atual from despesas_fixas_ocorrencias
    where despesa_fixa_id = p_despesa_fixa_id and ano = p_ano and mes = p_mes for update;
  v_ocorrencia_id := v_atual.id;
  if v_atual.cancelada_em is not null then
    return jsonb_build_object('ok', false, 'reason', 'Essa ocorrência está cancelada e não pode receber pagamento.');
  end if;

  select coalesce(sum(valor), 0) into v_pago_atual
    from despesa_ocorrencia_pagamentos
    where entidade = 'despesa_fixa_ocorrencia' and ocorrencia_id = v_ocorrencia_id and estornado_em is null;
  v_esperado := v_despesa.valor;
  v_saldo := v_esperado - v_pago_atual;

  if p_valor is null or p_valor <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'O valor pago precisa ser maior que zero.');
  end if;
  if p_valor > v_saldo then
    return jsonb_build_object('ok', false, 'reason', 'O valor informado é maior que o saldo em aberto dessa despesa.', 'saldo', v_saldo);
  end if;

  if v_pago_atual = 0 and v_atual.lancamento_id is not null then
    update lancamentos set valor = p_valor, data = p_data, status = 'realizado' where id = v_atual.lancamento_id;
    v_lancamento_id := v_atual.lancamento_id;
  else
    insert into lancamentos (tipo, descricao, categoria, valor, data, fornecedor_id, status)
    values ('Despesa', v_despesa.descricao || (case when v_pago_atual > 0 then ' (complemento)' else '' end),
      v_despesa.categoria, p_valor, p_data, v_despesa.fornecedor_id, 'realizado')
    returning id into v_lancamento_id;
  end if;

  insert into despesa_ocorrencia_pagamentos (entidade, ocorrencia_id, lancamento_id, valor, data, usuario_id)
  values ('despesa_fixa_ocorrencia', v_ocorrencia_id, v_lancamento_id, p_valor, p_data, auth.uid());

  update despesas_fixas_ocorrencias
  set valor_pago = v_pago_atual + p_valor, pago = (v_pago_atual + p_valor) >= v_esperado, pago_em = now(),
      lancamento_id = coalesce(v_atual.lancamento_id, v_lancamento_id)
  where id = v_ocorrencia_id;

  insert into financeiro_eventos (entidade, entidade_id, evento, valor_anterior, valor_novo, usuario_id)
  values ('despesa_fixa_ocorrencia', v_ocorrencia_id,
    case when v_pago_atual + p_valor >= v_esperado then 'pagamento_total' else 'pagamento_parcial' end,
    v_pago_atual, v_pago_atual + p_valor, auth.uid());

  return jsonb_build_object('ok', true, 'saldoRestante', greatest(0, v_esperado - v_pago_atual - p_valor));
end;
$$;

create or replace function estornar_pagamento_despesa_fixa_ocorrencia(p_pagamento_id uuid, p_motivo text) returns jsonb
language plpgsql security definer as $$
declare
  v_pag despesa_ocorrencia_pagamentos%rowtype;
begin
  if not is_admin_or_secretaria() then
    return jsonb_build_object('ok', false, 'reason', 'Apenas Administrador ou Secretaria pode estornar pagamento de despesa.');
  end if;

  select * into v_pag from despesa_ocorrencia_pagamentos where id = p_pagamento_id for update;
  if not found or v_pag.entidade <> 'despesa_fixa_ocorrencia' then
    return jsonb_build_object('ok', false, 'reason', 'Pagamento não encontrado.');
  end if;
  if v_pag.estornado_em is not null then
    return jsonb_build_object('ok', false, 'reason', 'Esse pagamento já foi estornado.');
  end if;

  update despesa_ocorrencia_pagamentos
  set estornado_em = now(), estornado_por = auth.uid(), motivo_estorno = p_motivo
  where id = p_pagamento_id;

  if v_pag.lancamento_id is not null then
    update lancamentos set status = 'cancelado' where id = v_pag.lancamento_id;
  end if;

  update despesas_fixas_ocorrencias o
  set valor_pago = (
        select coalesce(sum(valor), 0) from despesa_ocorrencia_pagamentos
        where entidade = 'despesa_fixa_ocorrencia' and ocorrencia_id = o.id and estornado_em is null
      ),
      pago = false
  where o.id = v_pag.ocorrencia_id;

  insert into financeiro_eventos (entidade, entidade_id, evento, valor_anterior, valor_novo, motivo, usuario_id)
  values ('despesa_fixa_ocorrencia', p_pagamento_id, 'estorno', v_pag.valor, 0, p_motivo, auth.uid());

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function registrar_pagamento_despesa_variavel_ocorrencia(
  p_despesa_variavel_id uuid, p_ano int, p_mes int, p_valor numeric, p_data date
) returns jsonb
language plpgsql security definer as $$
declare
  v_despesa despesas_variaveis%rowtype;
  v_ocorrencia_id uuid;
  v_pago_atual numeric(12, 2);
  v_esperado numeric(12, 2);
  v_saldo numeric(12, 2);
  v_lancamento_id uuid;
  v_atual despesas_variaveis_ocorrencias%rowtype;
begin
  if not is_admin_or_secretaria() then
    return jsonb_build_object('ok', false, 'reason', 'Apenas Administrador ou Secretaria pode registrar pagamento de despesa.');
  end if;

  select * into v_despesa from despesas_variaveis where id = p_despesa_variavel_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'Despesa variável não encontrada.'); end if;

  insert into despesas_variaveis_ocorrencias (despesa_variavel_id, ano, mes, valor_real, pago)
  values (p_despesa_variavel_id, p_ano, p_mes, v_despesa.valor_provisionado, false)
  on conflict (despesa_variavel_id, ano, mes) do nothing;

  select * into v_atual from despesas_variaveis_ocorrencias
    where despesa_variavel_id = p_despesa_variavel_id and ano = p_ano and mes = p_mes for update;
  v_ocorrencia_id := v_atual.id;
  if v_atual.cancelada_em is not null then
    return jsonb_build_object('ok', false, 'reason', 'Essa ocorrência está cancelada e não pode receber pagamento.');
  end if;

  select coalesce(sum(valor), 0) into v_pago_atual
    from despesa_ocorrencia_pagamentos
    where entidade = 'despesa_variavel_ocorrencia' and ocorrencia_id = v_ocorrencia_id and estornado_em is null;
  v_esperado := coalesce(v_atual.valor_real, v_despesa.valor_provisionado);
  v_saldo := v_esperado - v_pago_atual;

  if p_valor is null or p_valor <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'O valor pago precisa ser maior que zero.');
  end if;
  if p_valor > v_saldo then
    return jsonb_build_object('ok', false, 'reason', 'O valor informado é maior que o saldo em aberto dessa despesa.', 'saldo', v_saldo);
  end if;

  if v_pago_atual = 0 and v_atual.lancamento_id is not null then
    update lancamentos set valor = p_valor, data = p_data, status = 'realizado' where id = v_atual.lancamento_id;
    v_lancamento_id := v_atual.lancamento_id;
  else
    insert into lancamentos (tipo, descricao, categoria, valor, data, fornecedor_id, status)
    values ('Despesa', v_despesa.descricao || (case when v_pago_atual > 0 then ' (complemento)' else '' end),
      v_despesa.categoria, p_valor, p_data, v_despesa.fornecedor_id, 'realizado')
    returning id into v_lancamento_id;
  end if;

  insert into despesa_ocorrencia_pagamentos (entidade, ocorrencia_id, lancamento_id, valor, data, usuario_id)
  values ('despesa_variavel_ocorrencia', v_ocorrencia_id, v_lancamento_id, p_valor, p_data, auth.uid());

  update despesas_variaveis_ocorrencias
  set valor_pago = v_pago_atual + p_valor, pago = (v_pago_atual + p_valor) >= v_esperado, pago_em = now(),
      lancamento_id = coalesce(v_atual.lancamento_id, v_lancamento_id)
  where id = v_ocorrencia_id;

  insert into financeiro_eventos (entidade, entidade_id, evento, valor_anterior, valor_novo, usuario_id)
  values ('despesa_variavel_ocorrencia', v_ocorrencia_id,
    case when v_pago_atual + p_valor >= v_esperado then 'pagamento_total' else 'pagamento_parcial' end,
    v_pago_atual, v_pago_atual + p_valor, auth.uid());

  return jsonb_build_object('ok', true, 'saldoRestante', greatest(0, v_esperado - v_pago_atual - p_valor));
end;
$$;

create or replace function estornar_pagamento_despesa_variavel_ocorrencia(p_pagamento_id uuid, p_motivo text) returns jsonb
language plpgsql security definer as $$
declare
  v_pag despesa_ocorrencia_pagamentos%rowtype;
begin
  if not is_admin_or_secretaria() then
    return jsonb_build_object('ok', false, 'reason', 'Apenas Administrador ou Secretaria pode estornar pagamento de despesa.');
  end if;

  select * into v_pag from despesa_ocorrencia_pagamentos where id = p_pagamento_id for update;
  if not found or v_pag.entidade <> 'despesa_variavel_ocorrencia' then
    return jsonb_build_object('ok', false, 'reason', 'Pagamento não encontrado.');
  end if;
  if v_pag.estornado_em is not null then
    return jsonb_build_object('ok', false, 'reason', 'Esse pagamento já foi estornado.');
  end if;

  update despesa_ocorrencia_pagamentos
  set estornado_em = now(), estornado_por = auth.uid(), motivo_estorno = p_motivo
  where id = p_pagamento_id;

  if v_pag.lancamento_id is not null then
    update lancamentos set status = 'cancelado' where id = v_pag.lancamento_id;
  end if;

  update despesas_variaveis_ocorrencias o
  set valor_pago = (
        select coalesce(sum(valor), 0) from despesa_ocorrencia_pagamentos
        where entidade = 'despesa_variavel_ocorrencia' and ocorrencia_id = o.id and estornado_em is null
      ),
      pago = false
  where o.id = v_pag.ocorrencia_id;

  insert into financeiro_eventos (entidade, entidade_id, evento, valor_anterior, valor_novo, motivo, usuario_id)
  values ('despesa_variavel_ocorrencia', p_pagamento_id, 'estorno', v_pag.valor, 0, p_motivo, auth.uid());

  return jsonb_build_object('ok', true);
end;
$$;
-- Nenhum GRANT muda aqui — todas já concedidas a `authenticated` desde 0035/0037/0046. A
-- checagem de papel agora é a segunda camada (a primeira é o Server Action `requireRole`, que
-- já existia) — Produção autenticada continua com EXECUTE liberado (senão RLS/policies
-- internas quebrariam de forma confusa), mas a função recusa explicitamente com `ok: false`.

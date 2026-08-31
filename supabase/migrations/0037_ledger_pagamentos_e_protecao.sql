-- Correção pontual pós-Etapa-3 — 3 problemas reais encontrados em teste:
--
--   1) deleteServico apagava lancamentos junto (correção anterior errada) — histórico
--      financeiro nunca pode ser apagado por exclusão comum. Corrigido com triggers no banco
--      (não só na Server Action, já que a RLS de admin/secretaria libera DELETE direto do
--      navegador em lancamentos/servico_parcelas/servicos).
--   2) marcarParcelaPaga permitia receber mais que o saldo em aberto (devia bloquear).
--   3) estornar_pagamento_parcela (0036) só zera o total acumulado da parcela — sem jeito de
--      estornar um recebimento específico quando há mais de um. Resolvido com um ledger novo
--      (parcela_recebimentos) que registra cada recebimento individualmente.
--
-- Também: mesma falha de granularidade não existia nem BINÁRIO do lado de despesas fixas/
-- variáveis (só pago=true/false, sem pagamento parcial) — resolvido com o mesmo padrão de
-- ledger (despesa_ocorrencia_pagamentos). financeiro_eventos vira append-only de verdade
-- (não tinha policy separada de update/delete). Fecha o vazamento de leitura de `servicos`
-- pra Produção (RLS nunca tinha sido corrigida desde a Fase 1 original — risco documentado,
-- agora corrigido).
--
-- Não edita nenhuma migration anterior (0034/0035/0036 continuam intocadas). Não apaga tabela
-- nem dado nenhum.

-- ── 1) Ledger de recebimentos por parcela ──────────────────────────────────────────────────
create table parcela_recebimentos (
  id uuid primary key default gen_random_uuid(),
  parcela_id uuid not null references servico_parcelas(id) on delete cascade,
  lancamento_id uuid references lancamentos(id) on delete set null,
  valor numeric(12, 2) not null check (valor > 0),
  data date not null,
  forma_pagamento text,
  usuario_id uuid references profiles(id),
  criado_em timestamptz not null default now(),
  estornado_em timestamptz,
  estornado_por uuid references profiles(id),
  motivo_estorno text
);
create index parcela_recebimentos_parcela_idx on parcela_recebimentos(parcela_id);
alter table parcela_recebimentos enable row level security;
create policy parcela_recebimentos_all on parcela_recebimentos for all using (is_admin_or_secretaria());

-- ── 2) Ledger de pagamentos por ocorrência de despesa (fixa e variável) ────────────────────
alter table despesas_fixas_ocorrencias add column valor_pago numeric(12, 2);
alter table despesas_variaveis_ocorrencias add column valor_pago numeric(12, 2);

create table despesa_ocorrencia_pagamentos (
  id uuid primary key default gen_random_uuid(),
  entidade text not null check (entidade in ('despesa_fixa_ocorrencia', 'despesa_variavel_ocorrencia')),
  ocorrencia_id uuid not null,
  lancamento_id uuid references lancamentos(id) on delete set null,
  valor numeric(12, 2) not null check (valor > 0),
  data date not null,
  usuario_id uuid references profiles(id),
  criado_em timestamptz not null default now(),
  estornado_em timestamptz,
  estornado_por uuid references profiles(id),
  motivo_estorno text
);
create index despesa_ocorrencia_pagamentos_idx on despesa_ocorrencia_pagamentos(entidade, ocorrencia_id);
alter table despesa_ocorrencia_pagamentos enable row level security;
create policy despesa_ocorrencia_pagamentos_all on despesa_ocorrencia_pagamentos for all using (is_admin_or_secretaria());

-- ── 3) financeiro_eventos ganha 'servico' e 'parcela_recebimento' como entidade válida ─────
alter table financeiro_eventos drop constraint financeiro_eventos_entidade_check;
alter table financeiro_eventos add constraint financeiro_eventos_entidade_check
  check (entidade in ('lancamento', 'parcela', 'despesa_fixa_ocorrencia', 'despesa_variavel_ocorrencia', 'servico', 'parcela_recebimento'));

-- financeiro_eventos vira append-only de verdade — antes era "for all", dava pra editar/
-- apagar um evento de auditoria já gravado.
drop policy financeiro_eventos_all on financeiro_eventos;
create policy financeiro_eventos_select on financeiro_eventos for select using (is_admin_or_secretaria());
create policy financeiro_eventos_insert on financeiro_eventos for insert with check (is_admin_or_secretaria());

-- ── 4) Registrar/estornar recebimento de parcela — atômico, bloqueia saldo insuficiente ────
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
grant execute on function registrar_recebimento_parcela(uuid, numeric, date, text) to authenticated;

create or replace function estornar_recebimento_parcela(p_recebimento_id uuid, p_motivo text) returns jsonb
language plpgsql security definer as $$
declare
  v_rec parcela_recebimentos%rowtype;
begin
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
grant execute on function estornar_recebimento_parcela(uuid, text) to authenticated;

-- ── 5) Registrar/estornar pagamento de ocorrência de despesa (fixa) ────────────────────────
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
grant execute on function registrar_pagamento_despesa_fixa_ocorrencia(uuid, int, int, numeric, date) to authenticated;

create or replace function estornar_pagamento_despesa_fixa_ocorrencia(p_pagamento_id uuid, p_motivo text) returns jsonb
language plpgsql security definer as $$
declare
  v_pag despesa_ocorrencia_pagamentos%rowtype;
begin
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
grant execute on function estornar_pagamento_despesa_fixa_ocorrencia(uuid, text) to authenticated;

-- ── 6) Mesmo par pro lado das despesas variáveis ───────────────────────────────────────────
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
grant execute on function registrar_pagamento_despesa_variavel_ocorrencia(uuid, int, int, numeric, date) to authenticated;

create or replace function estornar_pagamento_despesa_variavel_ocorrencia(p_pagamento_id uuid, p_motivo text) returns jsonb
language plpgsql security definer as $$
declare
  v_pag despesa_ocorrencia_pagamentos%rowtype;
begin
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
grant execute on function estornar_pagamento_despesa_variavel_ocorrencia(uuid, text) to authenticated;

-- ── 7) Bloqueia exclusão definitiva de qualquer registro com dinheiro real movimentado ─────
-- Protege no banco (não só na Server Action) — a RLS de admin/secretaria hoje libera DELETE
-- direto do navegador em servicos/lancamentos/servico_parcelas, então bloquear só no botão da
-- tela não impede nada.
create or replace function bloquear_exclusao_com_historico() returns trigger
language plpgsql as $$
begin
  if TG_TABLE_NAME = 'servicos' then
    if exists (select 1 from lancamentos where servico_id = OLD.id and status = 'realizado')
       or exists (select 1 from servico_parcelas where servico_id = OLD.id and valor_pago is not null and valor_pago > 0) then
      raise exception 'Este serviço tem histórico financeiro (recebimento ou pagamento) e não pode ser excluído definitivamente. Cancele o serviço em vez de excluir.';
    end if;
  elsif TG_TABLE_NAME = 'lancamentos' then
    if OLD.status = 'realizado' then
      raise exception 'Um lançamento já realizado não pode ser excluído definitivamente. Cancele ou estorne em vez de excluir.';
    end if;
  elsif TG_TABLE_NAME = 'servico_parcelas' then
    if OLD.valor_pago is not null and OLD.valor_pago > 0 then
      raise exception 'Uma parcela com recebimento não pode ser excluída definitivamente. Estorne o recebimento antes de excluir.';
    end if;
  end if;
  return OLD;
end;
$$;

drop trigger if exists servicos_bloqueia_exclusao on servicos;
create trigger servicos_bloqueia_exclusao before delete on servicos
  for each row execute function bloquear_exclusao_com_historico();

drop trigger if exists lancamentos_bloqueia_exclusao on lancamentos;
create trigger lancamentos_bloqueia_exclusao before delete on lancamentos
  for each row execute function bloquear_exclusao_com_historico();

drop trigger if exists servico_parcelas_bloqueia_exclusao on servico_parcelas;
create trigger servico_parcelas_bloqueia_exclusao before delete on servico_parcelas
  for each row execute function bloquear_exclusao_com_historico();

-- ── 8) Cancelamento real de serviço (formaliza financeiro_status='Cancelado', já existente) ─
create or replace function cancelar_servico(p_servico_id uuid, p_motivo text) returns jsonb
language plpgsql security definer as $$
begin
  if not exists (select 1 from servicos where id = p_servico_id) then
    return jsonb_build_object('ok', false, 'reason', 'Serviço não encontrado.');
  end if;
  update servicos set financeiro_status = 'Cancelado' where id = p_servico_id;
  insert into financeiro_eventos (entidade, entidade_id, evento, motivo, usuario_id)
  values ('servico', p_servico_id, 'cancelamento', p_motivo, auth.uid());
  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function cancelar_servico(uuid, text) to authenticated;

-- ── 9) Fecha o vazamento de leitura de `servicos` pra Produção (risco documentado desde a
--       Fase 1 original — RLS nunca tinha sido corrigida) ──────────────────────────────────
-- Só SELECT e DELETE ficam restritos a admin/secretaria — Produção legitimamente faz UPDATE
-- direto em `servicos` hoje (toggleEntregaConfirmada/updateResponsavel/updatePrioridade, todas
-- com requireRole incluindo "producao"), protegido por COLUNA pelo trigger
-- `enforce_servico_permissions` (já existente, migration 0034) — restringir UPDATE por RLS
-- aqui quebraria essas 3 ações que Produção já usa no dia a dia. INSERT também fica aberto
-- (igual já era) porque `createServico` já é admin/secretaria só por Server Action, e
-- Produção nunca insere serviço.
drop policy if exists servicos_all on servicos;
create policy servicos_select_admin_secretaria on servicos for select using (is_admin_or_secretaria());
create policy servicos_write on servicos for insert with check (auth.role() = 'authenticated');
create policy servicos_update on servicos for update using (auth.role() = 'authenticated');
create policy servicos_delete_admin_secretaria on servicos for delete using (is_admin_or_secretaria());

-- Produção passa a não ler `servicos` direto — só via função segura (já existe
-- `get_servico_producao` pra 1 serviço; esta é a versão em lista, pros quadros/telas de
-- Produção que hoje fazem `select` direto da tabela inteira). Campos exatamente iguais a
-- `CAMPOS_SERVICO_PRODUCAO` (src/lib/domain/servicoProducao.ts) — todo campo de `servicos`
-- que NÃO é financeiro, pra bater 1:1 com o que `toServicoProducaoSafe()` já espera receber.
create or replace function listar_servicos_producao() returns setof jsonb
language plpgsql security definer as $$
begin
  return query
  select jsonb_build_object(
    'id', s.id, 'numero', s.numero, 'aprovado_em', s.aprovado_em, 'cliente_id', s.cliente_id,
    'cliente', s.cliente, 'descricao', s.descricao, 'tipo', s.tipo, 'estagio', s.estagio,
    'coluna_id', s.coluna_id, 'concluido', s.concluido, 'prazo', s.prazo, 'prazo_tipo', s.prazo_tipo,
    'prazo_inicio', s.prazo_inicio, 'informacoes_adicionais', s.informacoes_adicionais,
    'local_instalacao', s.local_instalacao, 'criado_em', s.criado_em, 'concluido_em', s.concluido_em,
    'responsavel', s.responsavel, 'prioridade', s.prioridade, 'entrega_confirmada', s.entrega_confirmada,
    'proxima_acao_texto', s.proxima_acao_texto, 'proxima_responsavel', s.proxima_responsavel,
    'proxima_prazo', s.proxima_prazo, 'motivo_espera', s.motivo_espera, 'capa_foto_id', s.capa_foto_id
  )
  from servicos s
  order by s.criado_em desc;
end;
$$;
grant execute on function listar_servicos_producao() to authenticated;

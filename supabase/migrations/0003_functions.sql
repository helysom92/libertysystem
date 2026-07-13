-- Sistema Liberty — business-logic functions
-- See C:\Users\DellUser\.claude\plans\replicated-scribbling-flame.md §4 for rationale.
-- Stage strings are ported verbatim from the prototype (Sistema Liberty.dc.html lines 721-748).

create or replace function flow_for_tipo(p_tipo servico_tipo) returns text[]
language sql immutable as $$
  select case p_tipo
    when 'medida_instalacao' then array[
      'Lead','Orçamento','Aprovado','Visita Técnica','Double Check de Medidas',
      'Arquivo Final','Produção','Acabamento','Instalação','Entrega','Concluído']
    when 'medida_sem_instalacao' then array[
      'Lead','Orçamento','Aprovado','Conferência de Medidas','Double Check de Medidas',
      'Arquivo Final','Produção','Entrega','Concluído']
    when 'simples' then array[
      'Pedido','Orçamento','Aprovado','Arquivo Final','Produção','Entrega','Concluído']
    when 'criacao' then array[
      'Briefing','Orçamento','Aprovado','Criação','Aprovação do Cliente','Arquivo Final','Concluído']
  end
$$;

create or replace function exige_medida(p_tipo servico_tipo) returns boolean
language sql immutable as $$
  select p_tipo in ('medida_instalacao','medida_sem_instalacao')
$$;

create or replace function stage_action_texto(p_estagio text) returns text
language sql immutable as $$
  select case p_estagio
    when 'Briefing' then 'Fazer briefing com o cliente'
    when 'Pedido' then 'Confirmar pedido'
    when 'Lead' then 'Enviar orçamento'
    when 'Orçamento' then 'Aguardar aprovação do cliente'
    when 'Aprovado' then 'Iniciar próxima etapa'
    when 'Visita Técnica' then 'Realizar visita técnica'
    when 'Conferência de Medidas' then 'Conferir medidas'
    when 'Double Check de Medidas' then 'Validar Double Check'
    when 'Criação' then 'Criar arte'
    when 'Aprovação do Cliente' then 'Aguardar aprovação da arte'
    when 'Arquivo Final' then 'Fechar arquivo de produção'
    when 'Produção' then 'Produzir material'
    when 'Acabamento' then 'Fazer acabamento'
    when 'Instalação' then 'Instalar no cliente'
    when 'Entrega' then 'Confirmar entrega'
    when 'Concluído' then 'Nenhuma'
    else null
  end
$$;

create or replace function stage_action_responsavel(p_estagio text) returns text
language sql immutable as $$
  select case p_estagio
    when 'Briefing' then 'Secretaria'
    when 'Pedido' then 'Secretaria'
    when 'Lead' then 'Secretaria'
    when 'Orçamento' then 'Secretaria'
    when 'Aprovado' then 'Secretaria'
    when 'Visita Técnica' then 'Produção'
    when 'Conferência de Medidas' then 'Produção'
    when 'Double Check de Medidas' then 'Administrador'
    when 'Criação' then 'Produção'
    when 'Aprovação do Cliente' then 'Secretaria'
    when 'Arquivo Final' then 'Produção'
    when 'Produção' then 'Produção'
    when 'Acabamento' then 'Produção'
    when 'Instalação' then 'Produção'
    when 'Entrega' then 'Secretaria'
    when 'Concluído' then '—'
    else null
  end
$$;

-- true iff every item in both jsonb arrays has done:true (vacuously true for empty arrays)
create or replace function dc_complete(p_dc_admin jsonb, p_dc_producao jsonb) returns boolean
language sql immutable as $$
  select
    not exists (select 1 from jsonb_array_elements(p_dc_admin) i where (i->>'done')::boolean is not true)
    and
    not exists (select 1 from jsonb_array_elements(p_dc_producao) i where (i->>'done')::boolean is not true)
$$;

-- ── move_servico: the stage-transition engine (mirrors prototype moveServico) ──
create or replace function move_servico(p_servico_id uuid, p_dir int) returns void
language plpgsql security definer as $$
declare
  sv servicos%rowtype;
  flow text[];
  idx int;
  next_idx int;
  novo_estagio text;
  entrega_ok boolean;
  financeiro_ok boolean;
begin
  select * into sv from servicos where id = p_servico_id;
  if not found then
    return;
  end if;

  flow := flow_for_tipo(sv.tipo);
  idx := array_position(flow, sv.estagio);
  if idx is null then
    return;
  end if;

  -- Gate 1: cannot leave Double Check de Medidas forward while incomplete
  if p_dir > 0 and sv.estagio = 'Double Check de Medidas' and not dc_complete(sv.dc_admin, sv.dc_producao) then
    return;
  end if;

  next_idx := least(greatest(idx + p_dir, 1), array_length(flow, 1));
  novo_estagio := flow[next_idx];
  if novo_estagio = sv.estagio then
    return;
  end if;

  -- Gate 2: conclusion gate (only when advancing into 'Concluído')
  if p_dir > 0 and novo_estagio = 'Concluído' then
    entrega_ok := (not ('Entrega' = any(flow))) or sv.entrega_confirmada;
    financeiro_ok := sv.financeiro_status in ('Pago','Cortesia') or sv.liberado_admin;
    if not (entrega_ok and financeiro_ok) then
      return;
    end if;
  end if;

  update servicos set
    estagio = novo_estagio,
    concluido_em = case when novo_estagio = 'Concluído' then now() else concluido_em end,
    proxima_acao_texto = coalesce(stage_action_texto(novo_estagio), proxima_acao_texto),
    proxima_responsavel = coalesce(stage_action_responsavel(novo_estagio), proxima_responsavel)
  where id = p_servico_id;

  insert into timeline_entries (servico_id, texto) values (p_servico_id, 'Etapa: ' || novo_estagio);
  insert into historico_entries (servico_id, texto)
    values (p_servico_id, (case when p_dir > 0 then 'Avançou' else 'Voltou' end) || ' para ' || novo_estagio);
end;
$$;

-- ── invalidate_dc: reset Double Check on new arquivo/medição (mirrors prototype invalidateDC) ──
create or replace function invalidate_dc_for_servico(p_servico_id uuid) returns void
language plpgsql security definer as $$
declare
  sv servicos%rowtype;
  admin_labels text[] := array[
    'Medidas conferidas','Proporção da arte','Textos','Posicionamento',
    'Aprovação do cliente','Briefing x arte x medidas','Arquivo final'];
  prod_labels text[] := array[
    'Dimensões','Unidade','Material','Espessura','Sangria','Margem',
    'Acabamento','Emendas','Quantidade','Estrutura/Fixação','Viabilidade de produção'];
  new_admin jsonb;
  new_prod jsonb;
begin
  select * into sv from servicos where id = p_servico_id;
  if not found or not exige_medida(sv.tipo) then
    return;
  end if;

  select jsonb_agg(jsonb_build_object('texto', t, 'done', false)) into new_admin
    from unnest(admin_labels) t;
  select jsonb_agg(jsonb_build_object('texto', t, 'done', false)) into new_prod
    from unnest(prod_labels) t;

  update servicos set
    dc_admin = new_admin,
    dc_producao = new_prod,
    dc_invalidated_after_advance = (sv.estagio <> 'Double Check de Medidas')
  where id = p_servico_id;

  insert into historico_entries (servico_id, texto)
    values (p_servico_id, 'Double Check invalidado por alteração');
end;
$$;

create or replace function trg_invalidate_dc_on_arquivo() returns trigger
language plpgsql as $$
begin
  perform invalidate_dc_for_servico(NEW.servico_id);
  return NEW;
end;
$$;
create trigger arquivos_invalidate_dc after insert on arquivos
  for each row execute function trg_invalidate_dc_on_arquivo();

create or replace function trg_invalidate_dc_on_medicao() returns trigger
language plpgsql as $$
begin
  perform invalidate_dc_for_servico(NEW.servico_id);
  return NEW;
end;
$$;
create trigger medicoes_invalidate_dc after insert on medicoes
  for each row execute function trg_invalidate_dc_on_medicao();

-- ── new-serviço seeding: initial estagio, DC checklists, proxima ação, timeline ──
create or replace function seed_new_servico() returns trigger
language plpgsql as $$
declare
  flow text[];
  admin_labels text[] := array[
    'Medidas conferidas','Proporção da arte','Textos','Posicionamento',
    'Aprovação do cliente','Briefing x arte x medidas','Arquivo final'];
  prod_labels text[] := array[
    'Dimensões','Unidade','Material','Espessura','Sangria','Margem',
    'Acabamento','Emendas','Quantidade','Estrutura/Fixação','Viabilidade de produção'];
begin
  flow := flow_for_tipo(NEW.tipo);
  if NEW.estagio is null then
    NEW.estagio := flow[1];
  end if;
  if NEW.proxima_acao_texto is null then
    NEW.proxima_acao_texto := stage_action_texto(NEW.estagio);
    NEW.proxima_responsavel := stage_action_responsavel(NEW.estagio);
  end if;
  if exige_medida(NEW.tipo) then
    select jsonb_agg(jsonb_build_object('texto', t, 'done', false)) into NEW.dc_admin from unnest(admin_labels) t;
    select jsonb_agg(jsonb_build_object('texto', t, 'done', false)) into NEW.dc_producao from unnest(prod_labels) t;
  end if;
  return NEW;
end;
$$;
create trigger servicos_seed before insert on servicos
  for each row execute function seed_new_servico();

create or replace function servico_after_insert_log() returns trigger
language plpgsql as $$
begin
  insert into timeline_entries (servico_id, texto) values (NEW.id, 'Serviço criado (' || NEW.estagio || ')');
  insert into historico_entries (servico_id, texto) values (NEW.id, 'Serviço criado');
  return NEW;
end;
$$;
create trigger servicos_after_insert after insert on servicos
  for each row execute function servico_after_insert_log();

-- ── cliente reuse-or-create helper (case-insensitive match) ──────────
create or replace function find_or_create_cliente(p_nome text) returns uuid
language plpgsql as $$
declare
  v_id uuid;
begin
  select id into v_id from clientes where nome_lower = lower(p_nome);
  if found then
    return v_id;
  end if;
  insert into clientes (nome) values (p_nome) returning id into v_id;
  return v_id;
end;
$$;

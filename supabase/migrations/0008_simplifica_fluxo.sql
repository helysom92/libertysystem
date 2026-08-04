-- Sistema Liberty — Fase 4: colapsa o fluxo de Serviços de 7-11 etapas nomeadas
-- por tipo para 3 etapas únicas: Orçamento -> Aprovado (OS) -> Concluído.
-- Double Check e as demais etapas de produção deixam de bloquear avanço de etapa
-- e viram marcadores informativos dentro da OS (aba Resumo).

create or replace function flow_for_tipo(p_tipo servico_tipo) returns text[]
language sql immutable as $$
  select array['Orçamento','Aprovado','Concluído']
$$;

create or replace function stage_action_texto(p_estagio text) returns text
language sql immutable as $$
  select case p_estagio
    when 'Orçamento' then 'Aguardar aprovação do cliente'
    when 'Aprovado' then 'Executar serviço (produção/instalação)'
    when 'Concluído' then 'Nenhuma'
    else null
  end
$$;

create or replace function stage_action_responsavel(p_estagio text) returns text
language sql immutable as $$
  select case p_estagio
    when 'Orçamento' then 'Secretaria'
    when 'Aprovado' then 'Produção'
    when 'Concluído' then '—'
    else null
  end
$$;

create or replace function move_servico(p_servico_id uuid, p_dir int) returns void
language plpgsql security definer as $$
declare
  sv servicos%rowtype;
  flow text[];
  idx int;
  next_idx int;
  novo_estagio text;
  financeiro_ok boolean;
  novo_numero text;
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

  next_idx := least(greatest(idx + p_dir, 1), array_length(flow, 1));
  novo_estagio := flow[next_idx];
  if novo_estagio = sv.estagio then
    return;
  end if;

  -- Gate de conclusão: entrega confirmada + financeiro ok (ou liberado pelo admin).
  if p_dir > 0 and novo_estagio = 'Concluído' then
    financeiro_ok := sv.financeiro_status in ('Pago','Cortesia') or sv.liberado_admin;
    if not (sv.entrega_confirmada and financeiro_ok) then
      return;
    end if;
  end if;

  -- Orçamento vira Ordem de Serviço (recebe numeração) na primeira aprovação.
  novo_numero := sv.numero;
  if novo_estagio = 'Aprovado' and sv.numero is null then
    novo_numero := 'OS-' || nextval('servico_numero_seq');
  end if;

  update servicos set
    estagio = novo_estagio,
    numero = novo_numero,
    concluido_em = case when novo_estagio = 'Concluído' then now() else concluido_em end,
    proxima_acao_texto = coalesce(stage_action_texto(novo_estagio), proxima_acao_texto),
    proxima_responsavel = coalesce(stage_action_responsavel(novo_estagio), proxima_responsavel)
  where id = p_servico_id;

  insert into timeline_entries (servico_id, texto) values (p_servico_id, 'Etapa: ' || novo_estagio);
  insert into historico_entries (servico_id, texto)
    values (p_servico_id, (case when p_dir > 0 then 'Avançou' else 'Voltou' end) || ' para ' || novo_estagio);
  if novo_numero is distinct from sv.numero then
    insert into historico_entries (servico_id, texto)
      values (p_servico_id, 'Orçamento aprovado — numeração ' || novo_numero || ' atribuída');
  end if;
end;
$$;

-- invalidate_dc_for_servico: "urgente" agora significa "a OS já está ativa" (Aprovado),
-- em vez de "já passou da etapa Double Check de Medidas" (que não existe mais).
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
    dc_invalidated_after_advance = (sv.estagio = 'Aprovado')
  where id = p_servico_id;

  insert into historico_entries (servico_id, texto)
    values (p_servico_id, 'Double Check invalidado por alteração');
end;
$$;

-- ── Backfill: migra estagios existentes para o novo modelo de 3 etapas ──
update servicos set estagio = 'Orçamento'
  where estagio in ('Lead','Pedido','Briefing');

update servicos set estagio = 'Aprovado'
  where estagio in (
    'Visita Técnica','Conferência de Medidas','Double Check de Medidas',
    'Criação','Aprovação do Cliente','Arquivo Final','Produção',
    'Acabamento','Instalação','Entrega'
  );

-- Sistema Liberty — número da Ordem de Serviço só é atribuído na aprovação
-- Antes disso, o serviço é um Orçamento sem numeração formal (plan extension,
-- pedido do usuário: "copiar o primeiro orçamento... cliente aprovando, aí vira
-- ORDEM DE SERVIÇO, com numeração").

alter table servicos alter column numero drop default;
alter table servicos alter column numero drop not null;

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

  if p_dir > 0 and sv.estagio = 'Double Check de Medidas' and not dc_complete(sv.dc_admin, sv.dc_producao) then
    return;
  end if;

  next_idx := least(greatest(idx + p_dir, 1), array_length(flow, 1));
  novo_estagio := flow[next_idx];
  if novo_estagio = sv.estagio then
    return;
  end if;

  if p_dir > 0 and novo_estagio = 'Concluído' then
    entrega_ok := (not ('Entrega' = any(flow))) or sv.entrega_confirmada;
    financeiro_ok := sv.financeiro_status in ('Pago','Cortesia') or sv.liberado_admin;
    if not (entrega_ok and financeiro_ok) then
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

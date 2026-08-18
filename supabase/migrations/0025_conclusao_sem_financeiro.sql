-- Produção e Financeiro são independentes (cada OS abre em dois menus separados, um não deve
-- travar o outro). A trava de conclusão do Kanban ainda exigia financeiro_status em
-- 'Pago'/'Cortesia' (ou liberação de Administrador) — mas o combinado com o cliente pode ser
-- em parcelas que ainda vão vencer depois da entrega. Produção conclui o serviço; a dívida
-- continua sendo acompanhada normalmente em Financeiro → Ordens de Serviço (saldo em aberto),
-- só não bloqueia mais o card de avançar pra "Concluído".
create or replace function move_card_para_coluna(p_servico_id uuid, p_coluna_id uuid) returns jsonb
language plpgsql security definer as $$
declare
  sv servicos%rowtype;
  col colunas%rowtype;
begin
  select * into sv from servicos where id = p_servico_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'Serviço não encontrado.');
  end if;

  select * into col from colunas where id = p_coluna_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'Coluna não encontrada.');
  end if;

  if col.is_conclusao and not sv.entrega_confirmada then
    return jsonb_build_object('ok', false, 'reason', 'Confirme a entrega antes de concluir.');
  end if;

  update servicos set
    coluna_id = col.id,
    estagio = col.label,
    concluido = col.is_conclusao,
    concluido_em = case when col.is_conclusao then now() else concluido_em end
  where id = p_servico_id;

  insert into timeline_entries (servico_id, texto) values (p_servico_id, 'Etapa: ' || col.label);
  insert into historico_entries (servico_id, texto) values (p_servico_id, 'Movido para ' || col.label);
  return jsonb_build_object('ok', true);
end;
$$;

-- Etapa 1 — Acessos, permissões e segurança.
--
-- Não apaga tabela nem dado nenhum. Só substitui policies (drop + create) e funções
-- (create or replace), e adiciona 1 policy nova + 1 trigger novo + 1 função nova.

-- 1) Trava o escalonamento de privilégio: hoje qualquer usuário autenticado consegue rodar
--    `update profiles set role='administrador' where id=auth.uid()` porque a policy
--    `profiles_update_self` só verifica a LINHA (id = auth.uid()), não a coluna que mudou.
create or replace function enforce_profile_role_change() returns trigger
language plpgsql as $$
begin
  if NEW.role is distinct from OLD.role and not is_admin() then
    raise exception 'Apenas Administrador pode alterar a função de um usuário';
  end if;
  return NEW;
end;
$$;

drop trigger if exists profiles_role_guard on profiles;
create trigger profiles_role_guard before update on profiles
  for each row execute function enforce_profile_role_change();

-- Administrador precisa poder atualizar QUALQUER perfil (hoje só dá pra atualizar o próprio,
-- então nem o admin conseguia mudar o papel de outra pessoa pelo app).
drop policy if exists profiles_update_admin on profiles;
create policy profiles_update_admin on profiles for update using (is_admin()) with check (is_admin());

-- 2) Metas e fechamento mensal viram exclusivos do Administrador (regra nova — antes
--    secretaria também tinha acesso de escrita nessas duas tabelas).
drop policy if exists metas_all on metas;
create policy metas_all on metas for all using (is_admin());

drop policy if exists fechamentos_mensais_all on fechamentos_mensais;
create policy fechamentos_mensais_all on fechamentos_mensais for all using (is_admin());

-- 3) Produção não precisa ler nem escrever parcelas nem opções de proposta interativa —
--    nenhuma das duas está na lista de dados que a Produção pode ver.
drop policy if exists servico_parcelas_all on servico_parcelas;
create policy servico_parcelas_all on servico_parcelas for all using (is_admin_or_secretaria());

drop policy if exists proposta_opcoes_all on proposta_opcoes;
create policy proposta_opcoes_all on proposta_opcoes for all using (is_admin_or_secretaria());
-- (as funções públicas get_proposta_interativa/escolher_proposta são security definer e
-- continuam funcionando pro link do cliente, independente dessa policy)

-- 4) Itens de orçamento e clientes: Produção precisa LER (item aprovado, medida, nome do
--    cliente) mas nunca precisa CRIAR/EDITAR/APAGAR (preço, cadastro completo).
drop policy if exists orcamento_itens_all on orcamento_itens;
create policy orcamento_itens_select on orcamento_itens for select using (auth.role() = 'authenticated');
create policy orcamento_itens_insert on orcamento_itens for insert with check (is_admin_or_secretaria());
create policy orcamento_itens_update on orcamento_itens for update using (is_admin_or_secretaria());
create policy orcamento_itens_delete on orcamento_itens for delete using (is_admin_or_secretaria());

drop policy if exists clientes_all on clientes;
create policy clientes_select on clientes for select using (auth.role() = 'authenticated');
create policy clientes_insert on clientes for insert with check (is_admin_or_secretaria());
create policy clientes_update on clientes for update using (is_admin_or_secretaria());
create policy clientes_delete on clientes for delete using (is_admin_or_secretaria());

-- Colunas do Kanban (as etapas em si) são configuração — só Administrador/Secretaria criam,
-- renomeiam ou apagam; Produção só precisa ler pra saber pra onde mover um card.
drop policy if exists colunas_all on colunas;
create policy colunas_select on colunas for select using (auth.role() = 'authenticated');
create policy colunas_insert on colunas for insert with check (is_admin_or_secretaria());
create policy colunas_update on colunas for update using (is_admin_or_secretaria());
create policy colunas_delete on colunas for delete using (is_admin_or_secretaria());

-- 5) Estende o guard de escrita financeira de `servicos` pra cobrir também `valor` (antes só
--    cobria financeiro_status/valor_pago/liberado_admin — valor ficava sem proteção nenhuma).
create or replace function enforce_servico_permissions() returns trigger
language plpgsql security definer as $$
begin
  if NEW.liberado_admin is distinct from OLD.liberado_admin and not is_admin_or_secretaria() then
    raise exception 'Apenas Administrador ou Secretaria pode liberar conclusão com financeiro pendente';
  end if;
  if (NEW.financeiro_status is distinct from OLD.financeiro_status
      or NEW.valor_pago is distinct from OLD.valor_pago
      or NEW.valor is distinct from OLD.valor) and not is_admin_or_secretaria() then
    raise exception 'Apenas Administrador ou Secretaria pode alterar financeiro do serviço';
  end if;
  return NEW;
end;
$$;

-- 6) Uma Ordem de Serviço (numero já atribuído) nunca pode ser movida de volta pra uma coluna
--    do quadro de Orçamentos — regra que faltava pra qualquer papel, não só Produção.
create or replace function move_card_para_coluna(p_servico_id uuid, p_coluna_id uuid) returns jsonb
language plpgsql security definer as $$
declare
  sv servicos%rowtype;
  col colunas%rowtype;
  financeiro_ok boolean;
begin
  select * into sv from servicos where id = p_servico_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'Serviço não encontrado.');
  end if;

  select * into col from colunas where id = p_coluna_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'Coluna não encontrada.');
  end if;

  if sv.numero is not null and col.board = 'orcamento' then
    return jsonb_build_object('ok', false, 'reason', 'Uma Ordem de Serviço não pode voltar para o quadro de Orçamentos.');
  end if;

  if col.is_conclusao then
    financeiro_ok := sv.financeiro_status in ('Pago', 'Cortesia') or sv.liberado_admin;
    if not (sv.entrega_confirmada and financeiro_ok) then
      return jsonb_build_object('ok', false, 'reason', 'Confirme a entrega e o financeiro (ou libere como Administrador) antes de concluir.');
    end if;
  end if;

  update servicos set
    coluna_id = col.id,
    estagio = col.label,
    concluido = col.is_conclusao,
    concluido_em = case when col.is_conclusao then now() else null end
  where id = p_servico_id;

  insert into timeline_entries (servico_id, texto) values (p_servico_id, 'Etapa: ' || col.label);
  insert into historico_entries (servico_id, texto) values (p_servico_id, 'Movido para ' || col.label);

  return jsonb_build_object('ok', true);
end;
$$;

-- 7) Leitura restrita pra Produção — só os campos aprovados na especificação. Não é RLS (RLS
--    não filtra coluna), é a fonte que a Central do Serviço usa quando quem abriu é Produção;
--    mesmo padrão já usado em get_proposta_publica/get_proposta_interativa.
create or replace function get_servico_producao(p_servico_id uuid) returns jsonb
language plpgsql security definer as $$
declare
  sv servicos%rowtype;
  cli clientes%rowtype;
begin
  select * into sv from servicos where id = p_servico_id;
  if not found then return null; end if;
  select * into cli from clientes where id = sv.cliente_id;

  return jsonb_build_object(
    'servico', jsonb_build_object(
      'id', sv.id, 'numero', sv.numero, 'descricao', sv.descricao, 'tipo', sv.tipo,
      'estagio', sv.estagio, 'coluna_id', sv.coluna_id, 'concluido', sv.concluido,
      'prazo', sv.prazo, 'prazo_tipo', sv.prazo_tipo, 'prazo_inicio', sv.prazo_inicio,
      'informacoes_adicionais', sv.informacoes_adicionais, 'local_instalacao', sv.local_instalacao,
      'responsavel', sv.responsavel, 'prioridade', sv.prioridade, 'capa_foto_id', sv.capa_foto_id,
      'proxima_acao_texto', sv.proxima_acao_texto, 'proxima_responsavel', sv.proxima_responsavel,
      'proxima_prazo', sv.proxima_prazo, 'motivo_espera', sv.motivo_espera,
      'entrega_confirmada', sv.entrega_confirmada, 'criado_em', sv.criado_em,
      'cliente_id', sv.cliente_id
    ),
    'cliente', jsonb_build_object('nome', cli.nome, 'whatsapp', cli.whatsapp),
    'itens', coalesce((select jsonb_agg(jsonb_build_object(
        'id', oi.id, 'descricao', oi.descricao, 'categoria_prazo', oi.categoria_prazo,
        'largura_cm', oi.largura_cm, 'altura_cm', oi.altura_cm, 'quantidade', oi.quantidade,
        'ordem', oi.ordem, 'mostrar_medida_cliente', oi.mostrar_medida_cliente
      ) order by oi.ordem) from orcamento_itens oi where oi.servico_id = sv.id), '[]'::jsonb)
  );
end;
$$;
grant execute on function get_servico_producao(uuid) to authenticated;

-- 8) Ações de Kanban que só Administrador/Secretaria devem poder fazer (criar/renomear/
--    apagar etapa, marcar coluna como conclusão, aprovar orçamento) continuam sem trava no
--    banco além da RLS de `colunas` acima — a trava de papel em si fica na Server Action
--    (requireRole), esta migration só cobre o que dá pra proteger em SQL.
